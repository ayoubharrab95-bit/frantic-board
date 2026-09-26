import { makeOpportunity } from '../opportunity.js';
import { boundedFetch } from './network.js';

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
  // Bound concurrency and preserve organization order in the output. The old
  // serial loop could take minutes when several organizations were slow.
  const handles = orgs.slice(0, 40);
  const rows = new Array(handles.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(4, handles.length) }, async () => {
    while (next < handles.length) {
      const index = next++;
      const handle = handles[index];
      try {
        const res = await boundedFetch(fetchImpl, `https://algora.io/${handle}/bounties`, {
          headers: { 'user-agent': 'moneyhunter-preflight/0.4' }
        });
        rows[index] = res.ok ? parseAlgoraOrg(handle, await res.text()) : [];
      } catch {
        rows[index] = [];
      }
    }
  }));
  const candidates = rows.flat().slice(0, limit * 2);
  const verified = new Array(candidates.length);
  let nextIssue = 0;
  await Promise.all(Array.from({ length: Math.min(4, candidates.length) }, async () => {
    while (nextIssue < candidates.length) {
      const index = nextIssue++;
      const item = candidates[index];
      const { org, repo, issue_number: number } = item.raw;
      try {
        const response = await boundedFetch(fetchImpl,
          `https://api.github.com/repos/${encodeURIComponent(org)}/${encodeURIComponent(repo)}/issues/${number}`,
          { headers: { accept: 'application/vnd.github+json',
            ...(process.env.GITHUB_TOKEN ? { authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}) } });
        if (!response.ok) continue;
        const issue = await response.json();
        if (issue.state !== 'open' || issue.pull_request) continue;
        item.raw.canonical_issue_url = issue.html_url;
        item.raw.origin_verified = true;
        verified[index] = item;
      } catch {
        // An inaccessible original is not evidence of an open, payable task.
      }
    }
  }));
  return verified.filter(Boolean).slice(0, limit);
}

export { DEFAULT_ORGS };
