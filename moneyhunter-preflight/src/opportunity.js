export function makeOpportunity(input) {
  return {
    id: String(input.id),
    source: input.source,
    url: input.url,
    title: input.title || '',
    reward: input.reward ?? null,
    currency: input.currency ?? null,
    status: input.status || 'unknown',
    available_slots: input.available_slots ?? null,
    active_claims: input.active_claims ?? null,
    ai_policy: input.ai_policy || 'unknown',
    raw: input.raw || {}
  };
}

export function opportunityKey(item) {
  return [item.source, item.id, item.url].filter(Boolean).join(':');
}
