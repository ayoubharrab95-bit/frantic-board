export function parseGitHubIssueUrl(input) {
  let url;
  try {
    url = new URL(input);
  } catch {
    throw new Error('A valid GitHub issue URL is required.');
  }
  if (url.hostname !== 'github.com') {
    throw new Error('Only github.com issue URLs are supported in v0.1.');
  }
  const parts = url.pathname.split('/').filter(Boolean);
  if (parts.length < 4 || parts[2] !== 'issues' || !/^\\d+$/.test(parts[3])) {
    throw new Error('Expected URL like https://github.com/owner/repo/issues/123');
  }
  return { owner: parts[0], repo: parts[1], issueNumber: Number(parts[3]) };
}