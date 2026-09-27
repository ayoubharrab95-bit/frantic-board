const DEFAULTS = {
  reservePct: 70,
  experimentPct: 10,
  workingPct: 20,
  maxSingleRiskPct: 5,
  minExpectedRoiPct: 8,
  minPaymentConfidence: 0.55,
  minExpectedHourlyUsd: 10
};

function num(v, fallback=0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export function buildCapitalPlan({ capitalUsd=5, opportunities=[], defaults={} }={}) {
  const cfg = { ...DEFAULTS, ...defaults };
  const capital = Math.max(0, num(capitalUsd));
  const reserve = capital * cfg.reservePct / 100;
  const experiment = capital * cfg.experimentPct / 100;
  const working = capital * cfg.workingPct / 100;
  const maxRisk = capital * cfg.maxSingleRiskPct / 100;

  const ranked = opportunities.map(o => {
    const expectedProfit = num(o.expected_profit_usd);
    const required = Math.max(0, num(o.required_capital_usd, 0));
    const roi = required > 0 ? expectedProfit / required * 100 : Infinity;
    const score = (Number.isFinite(roi) ? roi : 1000) * Math.max(0.05, num(o.acceptance_probability, 0.5));
    return { ...o, expected_roi_pct: Number.isFinite(roi) ? Number(roi.toFixed(2)) : null, allocation_score: Number(score.toFixed(2)) };
  }).filter(o => (o.expected_roi_pct == null || o.expected_roi_pct >= cfg.minExpectedRoiPct)
    && num(o.payment_confidence,0) >= cfg.minPaymentConfidence
    && num(o.economics?.expected_hourly_usd,0) >= cfg.minExpectedHourlyUsd)
    .sort((a,b)=>b.allocation_score-a.allocation_score);

  const allocations = [];
  let remaining = working;
  for (const o of ranked) {
    if (remaining <= 0) break;
    const requested = Math.min(num(o.required_capital_usd, maxRisk), maxRisk, remaining);
    if (requested <= 0) continue;
    allocations.push({ id:o.id, source:o.source, allocation_usd:Number(requested.toFixed(2)), expected_profit_usd:Number((num(o.expected_profit_usd) * (requested / Math.max(1,num(o.required_capital_usd,requested)))).toFixed(2)), status:'approval_required' });
    remaining -= requested;
  }

  return {
    generated_at:new Date().toISOString(),
    capital_usd:Number(capital.toFixed(2)),
    buckets:{
      reserve_usd:Number(reserve.toFixed(2)),
      experiments_usd:Number(experiment.toFixed(2)),
      working_usd:Number(working.toFixed(2)),
      unallocated_working_usd:Number(Math.max(0,remaining).toFixed(2))
    },
    rules:{
      reserve_pct:cfg.reservePct,
      experiment_pct:cfg.experimentPct,
      working_pct:cfg.workingPct,
      max_single_risk_usd:Number(maxRisk.toFixed(2)),
      min_expected_roi_pct:cfg.minExpectedRoiPct,
      min_payment_confidence:cfg.minPaymentConfidence,
      min_expected_hourly_usd:cfg.minExpectedHourlyUsd
    },
    allocations,
    guardrails:['planning only','no automatic spending','no private-key custody','irreversible financial actions require human approval']
  };
}
