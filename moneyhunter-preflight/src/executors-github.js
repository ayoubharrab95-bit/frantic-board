import { registerExecutor } from './executor.js';

async function githubComment(repo, issueNumber, body) {
  const token = process.env.GITHUB_TOKEN;
  if (!token) return { status: 'human_gate', reason: 'GITHUB_TOKEN_missing' };
  const res = await fetch(`https://api.github.com/repos/${repo}/issues/${issueNumber}/comments`, {
    method: 'POST',
    headers: {
      accept: 'application/vnd.github+json',
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      'user-agent': 'moneyhunter-preflight/0.8'
    },
    body: JSON.stringify({ body })
  });
  const raw = await res.text();
  let parsed;
  try { parsed = raw ? JSON.parse(raw) : {}; } catch { parsed = { raw }; }
  if (!res.ok) throw new Error(`GitHub HTTP ${res.status}: ${parsed?.message || raw.slice(0, 300)}`);
  return parsed;
}

function repoAndIssue(item = {}) {
  const repo = item.raw?.repo || item.raw?.repository || item.repo || '';
  const issue = Number(item.raw?.issue_number || item.issue_number);
  return { repo: String(repo), issue };
}

export function registerGitHubExecutor() {
  registerExecutor('github', {
    actions: ['claim'],
    ready: () => Boolean(process.env.GITHUB_TOKEN),
    async execute(item, { action = 'claim' } = {}) {
      if (action !== 'claim') return { status: 'blocked', reason: 'unsupported_action' };

      const { repo, issue } = repoAndIssue(item);
      const explicitClaim = item.raw?.claim_comment || item.raw?.claim_command;

      // GitHub itself has no universal bounty-claim protocol. Never invent one.
      // Only execute a claim when the source adapter supplied an explicit command.
      if (!repo || !Number.isInteger(issue) || issue <= 0) {
        return { status: 'prepare', reason: 'github_repo_or_issue_required' };
      }
      if (!explicitClaim) {
        return { status: 'prepare', reason: 'github_claim_protocol_not_confirmed' };
      }

      return {
        status: 'claimed',
        source: 'github',
        repo,
        issue_number: issue,
        claim_comment: await githubComment(repo, issue, String(explicitClaim))
      };
    }
  });
}
