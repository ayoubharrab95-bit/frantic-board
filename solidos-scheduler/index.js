const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;

if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  console.error("missing_scheduler_env");
  process.exit(2);
}

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
    try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text.slice(0, 1000) }; }
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

async function main() {
  const worker = await invoke("booked-solid-worker", {
    source: "render-heartbeat-v1",
    batch_size: 1,
    lane: "auto",
    maintenance: false,
  }, 175000);

  console.log(JSON.stringify({
    event: "worker_probe",
    status: worker.status,
    ms: worker.ms,
    processed: worker.data?.processed ?? null,
    idle: worker.data?.idle ?? null,
    deferred: worker.data?.deferred ?? null,
    reason: worker.data?.reason ?? null,
  }));

  // 202 means another worker owns the global lease; production is already moving.
  if (worker.status === 202) return;
  if (!worker.ok) {
    console.error(JSON.stringify({event:"worker_error", response:worker.data}));
    process.exit(1);
  }

  // Worker v179 self-chains while due work remains.
  // Only plan fresh discovery when the queue was idle at heartbeat time.
  if (worker.data?.idle === true || Number(worker.data?.processed ?? 0) === 0) {
    const planner = await invoke("booked-solid-orchestrator", {
      action: "plan",
      limit: 2,
      source: "render-heartbeat-v1",
    }, 145000);

    console.log(JSON.stringify({
      event: "planner_probe",
      status: planner.status,
      ms: planner.ms,
      queued: planner.data?.queued ?? null,
      deferred: planner.data?.deferred ?? null,
      reason: planner.data?.reason ?? null,
    }));

    if (!planner.ok && planner.status !== 202) {
      console.error(JSON.stringify({event:"planner_error", response:planner.data}));
      process.exit(1);
    }
  }
}

main().catch((error) => {
  console.error(JSON.stringify({
    event: "heartbeat_exception",
    name: error?.name || "Error",
    message: error?.message || String(error),
  }));
  process.exit(1);
});
