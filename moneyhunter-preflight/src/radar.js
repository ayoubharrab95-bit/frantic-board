import { discoverFrantic } from './sources/frantic.js';
import { opportunityKey } from './opportunity.js';

function valueScore(item) {
  const reward = item.reward ?? 0;
  const availability = item.available_slots == null ? 1 : Math.max(0, item.available_slots);
  const competitionPenalty = item.active_claims == null ? 1 : 1 / (1 + item.active_claims);
  const openMultiplier = item.status === 'open' ? 1 : 0;
  return reward * Math.min(3, Math.max(1, availability)) * competitionPenalty * openMultiplier;
}

export async function runRadar({ sources = ['frantic'], minReward = 5, limit = 25 } = {}) {
  const found = [];

  if (sources.includes('frantic')) {
    found.push(...await discoverFrantic({ limit }));
  }

  const seen = new Set();
  const deduped = [];
  for (const item of found) {
    const key = opportunityKey(item);
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(item);
  }

  return deduped
    .filter((item) => item.status === 'open')
    .filter((item) => (item.reward ?? 0) >= minReward)
    .map((item) => ({ ...item, radar_score: Number(valueScore(item).toFixed(2)) }))
    .sort((a, b) => b.radar_score - a.radar_score);
}
