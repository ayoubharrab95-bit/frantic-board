import { getSourcePriors } from './revenue-memory.js';
const DEFAULT_SOURCE_PRIOR = {
  frantic: 1.00,
  github: 0.82,
  algora: 0.90,
  opire: 0.55
};

let SOURCE_PRIOR = { ...DEFAULT_SOURCE_PRIOR };\nexport function setSourcePriors(priors={}) { SOURCE_PRIOR = { ...DEFAULT_SOURCE_PRIOR, ...priors }; return SOURCE_PRIOR; }\n\nfunction clamp(value, min=0, max=1) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}

export function estimateMinutes(item) {
  if (item.estimated_minutes != null) return Math.max(5, Number(item.estimated_minutes));
  const reward = Math.max(1, Number(item.reward) || 1);
  const base = item.source === 'frantic' ? 35 : item.source === 'algora' ? 60 : item.source === 'github' ? 75 : 100;
  const scale = Math.min(4, Math.max(0.5, Math.sqrt(reward / 25)));
  return Math.round(base * scale);
}

export function enrichEconomics(item) {
  const payment = clamp(item.payment_confidence);
  const competition = clamp(item.competition_score);
  const ai = item.ai_policy === 'allowed' ? 1 : item.ai_policy === 'unknown' ? 0.72 : 0;
  const sourcePrior = SOURCE_PRIOR[item.source] ?? 0.5;
  const acceptance = clamp(payment * 0.34 + competition * 0.30 + ai * 0.20 + sourcePrior * 0.16, 0.05, 0.95);
  const minutes = estimateMinutes(item);
  const reward = Math.max(0, Number(item.reward) || 0);
  const manualPenalty = item.requires_manual_payment ? 0.70 : 1;
  const expectedProfit = reward * acceptance * manualPenalty;
  const hourly = expectedProfit * 60 / minutes;
  return {
    estimated_minutes: minutes,
    acceptance_probability: Number(acceptance.toFixed(2)),
    expected_profit_usd: Number(expectedProfit.toFixed(2)),
    expected_hourly_usd: Number(hourly.toFixed(2))
  };
}

export function choosePortfolio(items, { limit=5, maxPerSource=2 } = {}) {
  const selected = [];
  const counts = new Map();
  for (const item of [...items].sort((a,b) =>
    (b.expected_hourly_usd ?? 0) - (a.expected_hourly_usd ?? 0) ||
    (b.expected_value_usd ?? 0) - (a.expected_value_usd ?? 0)
  )) {
    const count = counts.get(item.source) || 0;
    if (count >= maxPerSource) continue;
    selected.push(item);
    counts.set(item.source, count + 1);
    if (selected.length >= limit) break;
  }
  return selected;
}

export function buildStrategyPlan({ opportunities=[], sourceStatus={} } = {}) {
  const enriched = opportunities.map((item) => ({ ...item, economics: enrichEconomics(item) }));
  const portfolio = choosePortfolio(enriched);
  const failures = Object.entries(sourceStatus).filter(([,s]) => !s?.ok).map(([source,s]) => ({
    source,
    action: 'repair_or_deprioritize',
    reason: s.error || 'source returned an error'
  }));
  const thinSources = Object.entries(sourceStatus).filter(([,s]) => s?.ok && (s.found ?? 0) === 0).map(([source]) => ({
    source,
    action: 'expand_discovery',
    reason: 'source returned no qualifying opportunities'
  }));
  const experiments = [
    'Prefer opportunities with explicit AI permission and verifiable funding.',
    'Optimize for expected USD/hour, not headline bounty size.',
    'Keep source diversity so one marketplace outage cannot stop the engine.',
    'Use safe code/test/documentation improvements to raise discovery quality between bounty runs.'
  ];
  return {
    strategy_revision: '0.5.0',
    objective: 'maximize expected net revenue while preserving source diversity and payment reliability',
    portfolio,
    portfolio_count: portfolio.length,
    source_actions: [...failures, ...thinSources],
    experiments,
    guardrails: [
      'never spend user funds automatically',
      'never request or store private keys or seed phrases',
      'do not bypass platform rules or AI restrictions',
      'require human approval for legal consent, identity verification, wallet signing, or irreversible high-risk actions'
    ]
  };
}

export function improvementProposals({ sourceStatus={}, opportunities=[] } = {}) {
  const proposals = [];
  if (!sourceStatus.frantic?.ok) proposals.push('Repair Frantic discovery before allocating execution time there.');
  if (!sourceStatus.github?.ok) proposals.push('Refresh GitHub search strategy or authentication/rate-limit handling.');
  if (!sourceStatus.algora?.ok) proposals.push('Refresh Algora directory parsing and canonical GitHub verification.');
  if (!sourceStatus.opire?.ok) proposals.push('Refresh Opire parsing and require canonical issue verification.');
  if (opportunities.length < 3) proposals.push('Broaden discovery queries while keeping hard payment/AI-policy filters.');
  if (!opportunities.some((x) => x.source === 'frantic')) proposals.push('Increase Frantic discovery priority when its claim gate is open.');
  return [...new Set(proposals)];
}
