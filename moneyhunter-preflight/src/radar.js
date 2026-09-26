import { discoverFrantic } from './sources/frantic.js';
import { discoverGitHubPaid } from './sources/github-paid.js';
import { discoverAlgora } from './sources/algora.js';
import { discoverOpire } from './sources/opire.js';
import { opportunityKey } from './opportunity.js';

const CACHE_TTL_MS = Number(process.env.RADAR_CACHE_TTL_MS || 60_000);
const cache = new Map();

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

function expectedValue(item) {
  const reward = Math.max(0, Number(item.reward) || 0);
  const payment = normalizedPayment(item);
  const competition = normalizedCompetition(item);
  const ai = aiMultiplier(item);
  const manualPaymentPenalty = item.requires_manual_payment ? 0.7 : 1;
  const openMultiplier = item.status === 'open' ? 1 : 0;
  return reward * payment * competition * ai * manualPaymentPenalty * openMultiplier;
}

async function safe(label, fn) {
  try {
    return { label, items: await fn(), error: null };
  } catch (error) {
    return { label, items: [], error: error instanceof Error ? error.message : String(error) };
  }
}

function cacheKey({ sources, minReward, limit }) {
  return JSON.stringify({
    sources: [...sources].sort(),
    minReward,
    limit
  });
}

export function clearRadarCache() {
  cache.clear();
}

export async function runRadar({
  sources = ['frantic', 'github', 'algora', 'opire'],
  minReward = 5,
  limit = 25,
  useCache = true
} = {}) {
  const params = {
    sources: [...new Set(sources)].filter((s) => ['frantic', 'github', 'algora', 'opire'].includes(s)),
    minReward: Math.max(0, Number(minReward) || 0),
    limit: Math.min(100, Math.max(1, Number(limit) || 25))
  };

  const key = cacheKey(params);
  const cached = cache.get(key);
  if (useCache && cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return { ...cached.value, cached: true };
  }

  const jobs = [];
  if (params.sources.includes('frantic')) jobs.push(safe('frantic', () => discoverFrantic({ limit: params.limit })));
  if (params.sources.includes('github')) jobs.push(safe('github', () => discoverGitHubPaid({ limit: params.limit })));
  if (params.sources.includes('algora')) jobs.push(safe('algora', () => discoverAlgora({ limit: params.limit })));
  if (params.sources.includes('opire')) jobs.push(safe('opire', () => discoverOpire({ limit: params.limit })));

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
    .filter((item) => (item.reward ?? 0) >= params.minReward)
    .map((item) => {
      const payment = normalizedPayment(item);
      const competition = normalizedCompetition(item);
      const ev = expectedValue(item);
      return {
        ...item,
        expected_value_usd: Number(ev.toFixed(2)),
        radar_score: Number((ev * Math.max(0.25, payment) * Math.max(0.25, competition)).toFixed(2)),
        payment_confidence: Number(payment.toFixed(2)),
        competition_score: Number(competition.toFixed(2))
      };
    })
    .filter((item) => item.expected_value_usd > 0)
    .sort((a, b) => b.radar_score - a.radar_score || b.expected_value_usd - a.expected_value_usd)
    .slice(0, params.limit);

  const value = {
    generated_at: new Date().toISOString(),
    requested_sources: params.sources,
    source_status: Object.fromEntries(
      batches.map((b) => [
        b.label,
        b.error ? { ok: false, error: b.error } : { ok: true, found: b.items.length }
      ])
    ),
    count: opportunities.length,
    opportunities,
    cached: false
  };

  cache.set(key, { at: Date.now(), value });
  return value;
}
