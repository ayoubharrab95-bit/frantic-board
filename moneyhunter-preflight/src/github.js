import { parseGitHubIssueUrl } from './url.js';

const API = 'https://api.github.com';

function headers() {
  const h = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'bounty-preflight/0.1'
  };
  if (process.env.GITHUB_TOKEN) h.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  return h;
}

async function get(path, optional = false) {
  const response = await fetch(`${API}${path}`, { headers: headers() });
  if (optional && (response.status === 404 || response.status === 403)) return null;
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GitHub API ${response.status}: ${text.slice(0, 300)}`);
  }
  return response.json();
}

export async function fetchIssueContext(issueUrl) {
  const { owner, repo, issueNumber } = parseGitHubIssueUrl(issueUrl);
  const [issue, repository, comments, timeline] = await Promise.all([
    get(`/repos/${owner}/${repo}/issues/${issueNumber}`),
    get(`/repos/${owner}/${repo}`),
    get(`/repos/${owner}/${repo}/issues/${issueNumber}/comments?per_page=100`),
    get(`/repos/${owner}/${repo}/issues/${issueNumber}/timeline?per_page=100`, true)
  ]);

  const linkedPrs = [];
  for (const event of timeline || []) {
    if (event?.event !== 'cross-referenced') continue;
    const sourceIssue = event?.source?.issue;
    if (!sourceIssue?.pull_request) continue;
    linkedPrs.push({
      number: sourceIssue.number,
      state: sourceIssue.state,
      url: sourceIssue.html_url,
      title: sourceIssue.title
    });
  }

  return { owner, repo, issueNumber, issue, repository, comments, linkedPrs };
}