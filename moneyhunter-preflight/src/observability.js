const metrics = {
  started_at: new Date().toISOString(),
  requests_total: 0,
  preflight_total: 0,
  preflight_errors_total: 0,
  latency_ms_sum: 0
};

export function observeRequest() {
  metrics.requests_total += 1;
}

export function observePreflight({ ok, latencyMs }) {
  metrics.preflight_total += 1;
  if (!ok) metrics.preflight_errors_total += 1;
  metrics.latency_ms_sum += Math.max(0, Number(latencyMs) || 0);
}

export function snapshotMetrics() {
  return {
    ...metrics,
    avg_preflight_latency_ms:
      metrics.preflight_total > 0
        ? Math.round(metrics.latency_ms_sum / metrics.preflight_total)
        : 0
  };
}
