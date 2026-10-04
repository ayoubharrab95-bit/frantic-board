const http = require("http");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
const PORT = Number(process.env.PORT || 10000);
const HEARTBEAT_MS = Math.max(60000, Number(process.env.HEARTBEAT_MS || 120000));
const PLANNER_MIN_INTERVAL_MS = Math.max(
  180000,
  Number(process.env.PLANNER_MIN_INTERVAL_MS || 240000)
);
const PRESSURE_LATENCY_MS = Math.max(
  1000,
  Number(process.env.PLANNER_MAX_WORKER_IDLE_MS || 5000)
);

if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  console.error("missing_scheduler_env");
  process.exit(2);
}

let inFlight = false;
let state = {
  started_at: new Date().toISOString(),
  last_run_at: null,
  last_completed_at: null,
  last_ok: null,
  last_lane: null,
  last_worker_status: null,
  last_worker_ms: null,
  last_worker_processed: null,
  last_worker_idle: null,
  last_planner_status: null,
  last_planner_ms: null,
  last_planner_queued: null,
  last_planner_attempt_at: null,
  planner_skips: 0,
  pressure_skips: 0,
  last_error: null,
  runs: 0,
};

async function invoke(slug, body, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const started = Date.now();

  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/${slug}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_PUBLISHABLE_KEY,
        "Authorization": `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const text = await response.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { raw: text.slice(0, 1000) };
    }

    return {
      ok: response.ok,
      status: response.status,
      ms: Date.now() - started,
      data,
    };
  } finally {
    clearTimeout(timer);
  }
}

async function workerLane(lane, timeoutMs, trigger) {
  const worker = await invoke("booked-solid-worker", {
    source: "render-heartbeat-v3",
    batch_size: 1,
    lane,
    maintenance: false,
  }, timeoutMs);

  state.last_lane = lane;
  state.last_worker_status = worker.status;
  state.last_worker_ms = worker.ms;
  state.last_worker_processed = worker.data?.processed ?? null;
  state.last_worker_idle = worker.data?.idle ?? null;

  console.log(JSON.stringify({
    event: "worker_probe",
    trigger,
    lane,
    status: worker.status,
    ms: worker.ms,
    processed: state.last_worker_processed,
    idle: state.last_worker_idle,
    deferred: worker.data?.deferred ?? null,
    reason: worker.data?.reason ?? null,
  }));

  return worker;
}

async function heartbeat(trigger = "timer") {
  if (inFlight) {
    console.log(JSON.stringify({
      event: "heartbeat_skip",
      reason: "in_flight",
      trigger,
    }));
    return;
  }

  inFlight = true;
  state.last_run_at = new Date().toISOString();
  state.runs += 1;
  state.last_error = null;

  try {
    // Hot-path lanes only. Resolve is intentionally not polled directly here:
    // discovery/research bursts self-chain into Resolve, so one pathological
    // resolver cannot monopolize every external heartbeat.
    const lanes = [
      ["qualify", 45000],
      ["research", 75000],
      ["discovery", 75000],
    ];

    for (const [lane, timeoutMs] of lanes) {
      const worker = await workerLane(lane, timeoutMs, trigger);

      // Distinguish "another worker is active" from DB-preflight pressure.
      // Only a real lease conflict means production is already moving.
      if (worker.status === 202) {
        const reason = String(worker.data?.reason || "");
        if (reason === "worker_lease_busy") {
          state.last_ok = true;
          return;
        }

        if (reason === "db_preflight_unavailable" || reason === "db_preflight_timeout") {
          state.pressure_skips += 1;

          const nowMs = Date.now();
          const lastPlannerMs = state.last_planner_attempt_at
            ? Date.parse(state.last_planner_attempt_at)
            : 0;
          const plannerDue =
            !lastPlannerMs ||
            nowMs - lastPlannerMs >= Math.max(0, PLANNER_MIN_INTERVAL_MS - 5000);

          // Recovery pulse: do not let transient DB preflight pressure starve
          // discovery forever. At most once per planner interval, try a tiny
          // plan cycle that can seed fresh Discovery/Research work.
          if (plannerDue) {
            state.last_planner_attempt_at = new Date().toISOString();
            const planner = await invoke("booked-solid-orchestrator", {
              action: "plan",
              limit: 3,
              source: "render-heartbeat-v4-recovery",
            }, 60000);

            state.last_planner_status = planner.status;
            state.last_planner_ms = planner.ms;
            state.last_planner_queued = planner.data?.queued ?? null;

            console.log(JSON.stringify({
              event: "planner_recovery_probe",
              trigger,
              lane,
              status: planner.status,
              ms: planner.ms,
              queued: state.last_planner_queued,
              reason: planner.data?.reason ?? null,
            }));

            if (!planner.ok && planner.status !== 202) {
              throw new Error(
                `planner_recovery_http_${planner.status}:${JSON.stringify(planner.data).slice(0, 700)}`
              );
            }
          } else {
            state.planner_skips += 1;
          }

          state.last_ok = true;
          return;
        }

        state.last_ok = true;
        return;
      }

      if (!worker.ok) {
        throw new Error(
          `worker_${lane}_http_${worker.status}:${JSON.stringify(worker.data).slice(0, 700)}`
        );
      }

      const processed = Number(worker.data?.processed ?? 0);
      const idle = worker.data?.idle === true || processed === 0;

      if (processed > 0 && !idle) {
        // Worker v183+ self-chains the remaining due work.
        state.last_ok = true;
        return;
      }

      // An idle probe should be cheap. If it is not, Postgres is under pressure;
      // do not stack more lane probes or Planner work on top of it.
      if (worker.ms > PRESSURE_LATENCY_MS) {
        state.pressure_skips += 1;
        state.planner_skips += 1;
        console.log(JSON.stringify({
          event: "heartbeat_pressure_skip",
          trigger,
          lane,
          worker_ms: worker.ms,
          threshold_ms: PRESSURE_LATENCY_MS,
        }));
        state.last_ok = true;
        return;
      }
    }

    // All production lanes were idle and healthy. Planner is allowed only on
    // a slower cadence so planning can never become the hot path.
    const nowMs = Date.now();
    const lastPlannerMs = state.last_planner_attempt_at
      ? Date.parse(state.last_planner_attempt_at)
      : 0;
    const plannerDue =
      !lastPlannerMs ||
      nowMs - lastPlannerMs >= Math.max(0, PLANNER_MIN_INTERVAL_MS - 5000);

    if (!plannerDue) {
      state.planner_skips += 1;
      console.log(JSON.stringify({
        event: "planner_skip",
        trigger,
        reason: "planner_min_interval",
        last_planner_attempt_at: state.last_planner_attempt_at,
        min_interval_ms: PLANNER_MIN_INTERVAL_MS,
      }));
      state.last_ok = true;
      return;
    }

    state.last_planner_attempt_at = new Date().toISOString();

    const planner = await invoke("booked-solid-orchestrator", {
      action: "plan",
      limit: 3,
      source: "render-heartbeat-v3",
    }, 60000);

    state.last_planner_status = planner.status;
    state.last_planner_ms = planner.ms;
    state.last_planner_queued = planner.data?.queued ?? null;

    console.log(JSON.stringify({
      event: "planner_probe",
      trigger,
      status: planner.status,
      ms: planner.ms,
      queued: state.last_planner_queued,
      deferred: planner.data?.deferred ?? null,
      reason: planner.data?.reason ?? null,
    }));

    if (!planner.ok && planner.status !== 202) {
      throw new Error(
        `planner_http_${planner.status}:${JSON.stringify(planner.data).slice(0, 700)}`
      );
    }

    state.last_ok = true;
  } catch (error) {
    state.last_ok = false;
    state.last_error = error?.message || String(error);
    console.error(JSON.stringify({
      event: "heartbeat_error",
      trigger,
      error: state.last_error,
    }));
  } finally {
    state.last_completed_at = new Date().toISOString();
    inFlight = false;
  }
}

const server = http.createServer((req, res) => {
  if (req.url === "/health" || req.url === "/") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      ok: true,
      service: "solidos-heartbeat",
      version: 8,
      in_flight: inFlight,
      heartbeat_ms: HEARTBEAT_MS,
      planner_min_interval_ms: PLANNER_MIN_INTERVAL_MS,
      pressure_latency_ms: PRESSURE_LATENCY_MS,
      state,
    }));
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ ok: false, error: "not_found" }));
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(JSON.stringify({
    event: "server_started",
    version: 8,
    port: PORT,
    heartbeat_ms: HEARTBEAT_MS,
    planner_min_interval_ms: PLANNER_MIN_INTERVAL_MS,
    pressure_latency_ms: PRESSURE_LATENCY_MS,
  }));

  setTimeout(() => heartbeat("startup"), 2000);
});

setInterval(() => heartbeat("timer"), HEARTBEAT_MS);

const selfUrl =
  process.env.SELF_URL ||
  (process.env.RENDER_EXTERNAL_HOSTNAME
    ? `https://${process.env.RENDER_EXTERNAL_HOSTNAME}`
    : null) ||
  "https://solidos-heartbeat.onrender.com";

setInterval(async () => {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    const response = await fetch(`${selfUrl}/health`, {
      signal: controller.signal,
    });
    clearTimeout(timer);

    console.log(JSON.stringify({
      event: "self_ping_ok",
      status: response.status,
    }));
  } catch (error) {
    console.error(JSON.stringify({
      event: "self_ping_error",
      error: error?.message || String(error),
    }));
  }
}, 8 * 60 * 1000);
