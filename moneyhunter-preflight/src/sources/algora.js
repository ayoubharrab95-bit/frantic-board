import { makeOpportunity } from '../opportunity.js';

const DEFAULT_ORGS = [
  'projectdiscovery',
  'highlight',
  'tscircuit',
  'calcom',
  'twenty',
  'triggerdotdev',
  'mendableai',
  'comfyorg',
  'ziverge',
  'shuttle',
  'qdrant',
  'permitio',
  'capsoftware',
  'opral',
  'px4',
  'zbd'
];

function strip(html = '') {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseAlgoraOrg(handle, html = '') {
  const text = strip(html);
  if (/No open bounties/i.test(text)) return [];

  const results = [];
  const re = /\$\s*([0-9][0-9,]*(?:\.\d{1,2})?)\s+([A-Za-z0-9_.-]+)#(\d+)\s+(.{3,180}?)\s+(?:(\d+)\s+claims?|Edit Amount|Delete|Completed|Open)/g;
  let m;

  while ((m = re.exec(text))) {
    const reward = Number(m[1].replace(/,/g, ''));
    if (!Number.isFinite(reward)) continue;

    const repo = m[2];
    const issue = m[3];
    const title = m[4].replace(/\s+/g, ' ').trim();
    const claims = Number(m[5] || 0);

    results.push(makeOpportunity({
      id: `algora-${handle}-${repo}-${issue}`,
      source: 'algora',
      url: `https://algora.io/${handle}/bounties`,
      title: `${repo}#${issue} ${title}`,
      reward,
      currency: 'USD',
      status: 'open',
      active_claims: claims,
      ai_policy: 'unknown',
      payment_confidence: 0.82,
      competition_score: Math.max(0.04, 1 / (1 + claims / 3)),
      requires_manual_payment: false,
      raw: { org: handle, repo, issue_number: Number(issue), claims }
    }));
  }

  return results;
}

export async function discoverAlgora({
  limit = 25,
  orgs = DEFAULT_ORGS,
  fetchImpl = fetch
} = {}) {
  const all = [];

  for (const handle of orgs) {
    if (all.length >= limit * 2) break;
    try {
      const res = await fetchImpl(`https://algora.io/${handle}/bounties`, {
        headers: { 'user-agent': 'moneyhunter-preflight/0.3' }
      });
      if (!res.ok) continue;
      all.push(...parseAlgoraOrg(handle, await res.text()));
    } catch {
      // One organization should never stop the entire radar.
    }
  }

  return all.slice(0, limit);
}

export { DEFAULT_ORGS };
