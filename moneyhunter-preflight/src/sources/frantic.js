import { makeOpportunity } from '../opportunity.js';

const BASE = 'https://gofrantic.com';

export function parseFranticIndex(html = '') {
  const ids = new Set();
  const re = /href=["']\/bounties\/(\d+)(?:["'?#/])/gi;
  let match;
  while ((match = re.exec(html))) ids.add(match[1]);
  return [...ids];
}

function numberAfter(label, html) {
  const clean = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  const re = new RegExp(`${label}\\s*(\\d+)`, 'i');
  const m = clean.match(re);
  return m ? Number(m[1]) : null;
}

export function parseFranticBountyPage(id, html = '') {
  const text = html.replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();

  const titleMatch = text.match(new RegExp(`#${id}\\s+(.+?)(?=\\s+(?:claim|claims|endpoint|requires|ledger|receipts|\\$\\d))`, 'i'));
  const rewardMatch =
    text.match(/(?:paid bounty is|reward|bounty)\s*\$\s*([0-9]+(?:\.[0-9]+)?)/i) ||
    text.match(/\$\s*([0-9]+(?:\.[0-9]+)?)/);

  const available = numberAfter('available', html);
  const active = numberAfter('active', html);

  let status = 'unknown';
  if (/claim gate open|ready to work|available\s+\d+\/\d+/i.test(text)) status = 'open';
  if (/claim gate closed|sold out|no claims available|closed/i.test(text)) status = 'closed';

  return makeOpportunity({
    id,
    source: 'frantic',
    url: `${BASE}/bounties/${id}`,
    title: titleMatch?.[1]?.trim() || `Frantic bounty #${id}`,
    reward: rewardMatch ? Number(rewardMatch[1]) : null,
    currency: rewardMatch ? 'USD' : null,
    status,
    available_slots: available,
    active_claims: active,
    ai_policy: 'allowed',
    raw: { text }
  });
}

async function get(url, fetchImpl = fetch) {
  const response = await fetchImpl(url, {
    headers: { 'user-agent': 'moneyhunter-preflight/0.2' }
  });
  if (!response.ok) throw new Error(`Frantic HTTP ${response.status} for ${url}`);
  return response.text();
}

export async function discoverFrantic({ limit = 20, fetchImpl = fetch } = {}) {
  const indexHtml = await get(BASE, fetchImpl);
  const ids = parseFranticIndex(indexHtml).slice(0, limit);
  const results = [];

  for (const id of ids) {
    try {
      const html = await get(`${BASE}/bounties/${id}`, fetchImpl);
      results.push(parseFranticBountyPage(id, html));
    } catch (error) {
      results.push(makeOpportunity({
        id,
        source: 'frantic',
        url: `${BASE}/bounties/${id}`,
        title: `Frantic bounty #${id}`,
        status: 'error',
        ai_policy: 'allowed',
        raw: { error: error instanceof Error ? error.message : String(error) }
      }));
    }
  }

  return results;
}
