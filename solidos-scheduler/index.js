const http = require("http");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
const PORT = Number(process.env.PORT || 10000);

if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  console.error("missing_scheduler_env");
  process.exit(2);
}

let inFlight = null;
let lastRun = null;

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
    try { data = text ? JSON.parse(text) : null; }
    catch { data = { raw: text.slice(0, 1000) }; }
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

async function heartbeat() {
  const startedAt = new Date().toISOString();

  const worker = await invoke("booked-solid-worker", {
    source: "render-heartbeat-v2",
    batch_size: 1,
    lane: "auto",
    maintenance: false,
  }, 175000);

  const result = {
    started_at: startedAt,
    worker: {
      status: worker.status,
      ms: worker.ms,
      processed: worker.data?.processed ?? null,
      idle: worker.data?.idle ?? null,
      deferred: worker.data?.deferred ?? null,
      reason: worker.data?.reason ?? null,
    },
    planner: null,
  };

  // 202 means another worker owns the lease: production is already moving.
  if (worker.status === 202) {
    lastRun = { ...result, completed_at: new Date().toISOString() };
    return lastRun;
  }

  if (!worker.ok) {
    throw new Error("worker_http_" + worker.status + ":" + JSON.stringify(worker.data));
  }

  // Worker v179 self-chains while due work remains.
  // Plan fresh discovery only when the queue was idle at heartbeat time.
  if (worker.data?.idle === true || Number(worker.data?.processed ?? 0) === 0) {
    const planner = await invoke("booked-solid-orchestrator", {
      action: "plan",
      limit: 2,
      source: "render-heartbeat-v2",
    }, 145000);

    result.planner = {
      status: planner.status,
      ms: planner.ms,
      queued: planner.data?.queued ?? null,
      deferred: planner.data?.deferred ?? null,
      reason: planner.data?.reason ?? null,
    };

    if (!planner.ok && planner.status !== 202) {
      throw new Error("planner_http_" + planner.status + ":" + JSON.stringify(planner.data));
    }
  }

  lastRun = { ...result, completed_at: new Date().toISOString() };
  console.log(JSON.stringify({ event: "heartbeat_complete", ...lastRun }));
  return lastRun;
}

async function runHeartbeat() {
  if (inFlight) return inFlight;
  inFlight = heartbeat()
    .catch((error) => {
      const failure = {
        completed_at: new Date().toISOString(),
        error: error?.message || String(error),
      };
      lastRun = failure;
      console.error(JSON.stringify({ event: "heartbeat_failed", ...failure }));
      throw error;
    })
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

const server = http.createServer(async (req, res) => {
  res.setHeader("Content-Type", "application/json");

  if (req.url === "/health") {
    res.statusCode = 200;
    res.end(JSON.stringify({
      ok: true,
      service: "solidos-heartbeat",
      in_flight: Boolean(inFlight),
      last_run: lastRun,
    }));
    return;
  }

  if (req.url === "/tick") {
    try {
      const result = await runHeartbeat();
      res.statusCode = 200;
      res.end(JSON.stringify({ ok: true, result }));
    } catch (error) {
      res.statusCode = 500;
      res.end(JSON.stringify({ ok: false, error: error?.message || String(error) }));
    }
    return;
  }

  res.statusCode = 404;
  res.end(JSON.stringify({ ok: false, error: "not_found" }));
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(JSON.stringify({
    event: "scheduler_listening",
    port: PORT,
  }));
});
