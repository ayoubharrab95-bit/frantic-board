import { makeOpportunity } from '../opportunity.js';

const BASE = 'https://gofrantic.com';

function normalizeRows(board = {}) {
  return [
    ...(Array.isArray(board.open_bounties) ? board.open_bounties : []),
    ...(Array.isArray(board.bounties) ? board.bounties : [])
  ];
}

function parseRow(row) {
  const number = row.number ?? row.id ?? row.posting_id;
  const claim = row.actions?.claim || {};
  const slots = row.claim_slots || {};
  const price = Number(row.price_usd ?? row.price ?? 0);
  const funded = row.funded === true;
  const claimAvailable = claim.available === true && Number(slots.available ?? 1) > 0;
  const claimState = String(claim.state || '');

  return makeOpportunity({
    id: `frantic-${String(number)}`,
    source: 'frantic',
    url: row.url ? (String(row.url).startsWith('http') ? row.url : BASE + row.url) : `${BASE}/bounties/${number}`,
    title: row.title || `Frantic bounty #${number}`,
    reward: Number.isFinite(price) ? price : null,
    currency: 'USD',
    status: funded && claimAvailable ? 'open' : 'closed',
    available_slots: Number(slots.available ?? 0),
    active_claims: Number(slots.occupied ?? 0),
    ai_policy: 'allowed',
    payment_confidence: funded ? 0.98 : 0.20,
    competition_score: Math.max(0.05, Math.min(1, Number(slots.available ?? 0) / Math.max(1, Number(slots.capacity ?? 1)))),
    requires_manual_payment: false,
    claim_api_available: true,
    submit_api_available: true,
    requires_kyc: claimState === 'requires_identity',
    raw: {
      bounty_id: number,
      funded,
      work_status: row.work_status ?? null,
      claim_state: claimState,
      claim_reason: claim.reason ?? null,
      claim_slots: slots,
      api_url: row.api_url ? (String(row.api_url).startsWith('http') ? row.api_url : BASE + row.api_url) : null,
      visibility: row.visibility ?? 'public'
    }
  });
}

export function parseFranticBoard(board = {}) {
  const rows = normalizeRows(board);
  const seen = new Set();
  const out = [];
  for (const row of rows) {
    const key = String(row.number ?? row.id ?? row.posting_id ?? row.url ?? '');
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const item = parseRow(row);
    if (item.reward != null && item.reward >= 0) out.push(item);
  }
  return out;
}

async function getBoard(fetchImpl = fetch) {
  const response = await fetchImpl(`${BASE}/v1/board`, {
    headers: { accept: 'application/json', 'user-agent': 'moneyhunter-preflight/0.8' }
  });
  if (!response.ok) throw new Error(`Frantic HTTP ${response.status} for /v1/board`);
  return response.json();
}

export async function discoverFrantic({ limit = 20, fetchImpl = fetch } = {}) {
  const board = await getBoard(fetchImpl);
  return parseFranticBoard(board)
    .filter(item => item.status === 'open')
    .sort((a, b) =>
      (b.payment_confidence ?? 0) - (a.payment_confidence ?? 0) ||
      (b.reward ?? 0) - (a.reward ?? 0) ||
      (b.competition_score ?? 0) - (a.competition_score ?? 0)
    )
    .slice(0, limit);
}
