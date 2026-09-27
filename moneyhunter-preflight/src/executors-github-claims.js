import { registerExecutor } from './executor.js';

async function githubComment(repo, issue_number, body) {
  const token = process.env.GITHUB_TOKEN;
  if (!token) return { status: 'human_gate', reason: 'GITHUB_TOKEN_missing' };
  const res = await fetch(`https://api.github.com/repos/${repo}/issues/${issue_number}/comments`, {
    method: 'POST',
    headers: {
      accept: 'application/vnd.github+json',
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      'user-agent': 'moneyhunter-preflight/0.7'
    },
    body: JSON.stringify({ body })
  });
  const raw = await res.text();
  let parsed; try { parsed = raw ? JSON.parse(raw) : {}; } catch { parsed = { raw }; }
  if (!res.ok) throw new Error(`GitHub HTTP ${res.status}: ${parsed?.message || raw.slice(0, 300)}`);
  return parsed;
}

function prParts(value = '') {
  const m = String(value).match(/github\.com\/([^/]+\/[^/]+)\/pull\/(\d+)/i);
  return m ? { repo: m[1], number: Number(m[2]) } : null;
}

export function registerGitHubClaimExecutors() {
  for (const source of ['algora', 'opire']) {
    registerExecutor(source, {
      actions: ['claim'],
      ready: () => Boolean(process.env.GITHUB_TOKEN),
      async execute(item, { action = 'claim', pr_url, issue_number } = {}) {
        if (action !== 'claim') return { status: 'blocked', reason: 'unsupported_action' };
        const parsed = prParts(pr_url || item.raw?.pr_url || '');
        if (!parsed) return { status: 'prepare', reason: 'pr_required_before_claim' };

        const issue = Number(issue_number || item.raw?.issue_number);
        if (!Number.isInteger(issue) || issue <= 0) return { status: 'blocked', reason: 'issue_number_required' };

        return {
          status: 'claimed',
          source,
          pr_url: pr_url || item.raw?.pr_url,
          claim_comment: await githubComment(parsed.repo, parsed.number, `/claim #${issue}`)
        };
      }
    });
  }
}
