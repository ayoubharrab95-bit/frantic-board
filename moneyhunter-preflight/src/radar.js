import { discoverFrantic } from './sources/frantic.js';
import { discoverGitHubPaid } from './sources/github-paid.js';
import { discoverAlgora } from './sources/algora.js';
import { discoverOpire } from './sources/opire.js';
import { opportunityKey } from './opportunity.js';

function normalizedCompetition(item) {
  if (item.competition_score != null) return Math.max(0, Math.min(1, item.competition_score));
  const claims = item.active_claims ?? 0;
  return 1 / (1 + claims);
}

function normalizedPayment(item) {
  if (item.payment_confidence != null) return Math.max(0, Math.min(1, item.payment_confidence));
  if (item.source === 'frantic') return 0.9;
  return 0.4;
}

function aiMultiplier(item) {
  if (item.ai_policy === 'prohibited') return 0;
  if (item.ai_policy === 'allowed') return 1;
  return 0.72;
}

function valueScore(item) {
  const reward = item.reward ?? 0;
  const availability = item.available_slots == null ? 1 : Math.max(0, item.available_slots);
  const availabilityBoost = Math.min(2, Math.max(1, availability));
  const payment = normalizedPayment(item);
  const competition = normalizedCompetition(item);
  const manualPaymentPenalty = item.requires_manual_payment ? 0.7 : 1;
  const openMultiplier = item.status === 'open' ? 1 : 0;
  return reward * payment * competition * aiMultiplier(item) * manualPaymentPenalty * availabilityBoost * openMultiplier;
}

async function safe(label, fn) {
  try {
    return { label, items: await fn(), error: null };
  } catch (error) {
    return { label, items: [], error: error instanceof Error ? error.message : String(error) };
  }
}

export async function runRadar({
  sources = ['frantic', 'github', 'algora', 'opire'],
  minReward = 5,
  limit = 25
} = {}) {
  const jobs = [];

  if (sources.includes('frantic')) jobs.push(safe('frantic', () => discoverFrantic({ limit })));
  if (sources.includes('github')) jobs.push(safe('github', () => discoverGitHubPaid({ limit })));
  if (sources.includes('algora')) jobs.push(safe('algora', () => discoverAlgora({ limit })));
  if (sources.includes('opire')) jobs.push(safe('opire', () => discoverOpire({ limit })));

  const batches = await Promise.all(jobs);
  const found = batches.flatMap((b) => b.items);

  const seen = new Set();
  const deduped = [];
  for (const item of found) {
    const key = opportunityKey(item);
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(item);
  }

  const opportunities = deduped
    .filter((item) => item.status === 'open')
    .filter((item) => item.ai_policy !== 'prohibited')
    .filter((item) => (item.reward ?? 0) >= minReward)
    .map((item) => ({
      ...item,
      radar_score: Number(valueScore(item).toFixed(2)),
      payment_confidence: Number(normalizedPayment(item).toFixed(2)),
      competition_score: Number(normalizedCompetition(item).toFixed(2))
    }))
    .filter((item) => item.radar_score > 0)
    .sort((a, b) => b.radar_score - a.radar_score)
    .slice(0, limit);

  return {
    generated_at: new Date().toISOString(),
    requested_sources: sources,
    source_status: Object.fromEntries(batches.map((b) => [b.label, b.error ? { ok: false, error: b.error } : { ok: true, found: b.items.length }])),
    count: opportunities.length,
    opportunities
  };
}
