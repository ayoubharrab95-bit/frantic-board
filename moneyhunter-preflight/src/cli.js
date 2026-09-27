import { analyzeIssueUrl } from './analyze.js';

const issueUrl = process.argv[2];

if (!issueUrl) {
  console.error('Usage: node src/cli.js https://github.com/owner/repo/issues/123');
  process.exit(2);
}

try {
  const result = await analyzeIssueUrl(issueUrl);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
