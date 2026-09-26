const metrics = {
  started_at: new Date().toISOString(),
  requests_total: 0,
  preflight_total: 0,
  preflight_errors_total: 0,
  preflight_latency_ms_sum: 0,
  radar_total: 0,
  radar_errors_total: 0,
  radar_latency_ms_sum: 0,
  payment_checks_total: 0,
  payment_check_errors_total: 0
};

export function observeRequest() {
  metrics.requests_total += 1;
}

export function observePreflight({ ok, latencyMs }) {
  metrics.preflight_total += 1;
  if (!ok) metrics.preflight_errors_total += 1;
  metrics.preflight_latency_ms_sum += Math.max(0, Number(latencyMs) || 0);
}

export function observeRadar({ ok, latencyMs }) {
  metrics.radar_total += 1;
  if (!ok) metrics.radar_errors_total += 1;
  metrics.radar_latency_ms_sum += Math.max(0, Number(latencyMs) || 0);
}

export function observePaymentCheck({ ok }) {
  metrics.payment_checks_total += 1;
  if (!ok) metrics.payment_check_errors_total += 1;
}

export function snapshotMetrics() {
  return {
    ...metrics,
    avg_preflight_latency_ms:
      metrics.preflight_total > 0
        ? Math.round(metrics.preflight_latency_ms_sum / metrics.preflight_total)
        : 0,
    avg_radar_latency_ms:
      metrics.radar_total > 0
        ? Math.round(metrics.radar_latency_ms_sum / metrics.radar_total)
        : 0
  };
}
