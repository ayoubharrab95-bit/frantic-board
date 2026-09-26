import { McpServer } from '@modelcontextprotocol/server';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import * as z from 'zod/v4';
import { analyzeIssueUrl } from './analyze.js';

serveStdio(() => {
  const server = new McpServer({
    name: 'bounty-preflight',
    version: '0.1.0'
  });

  server.registerTool(
    'preflight_github_bounty',
    {
      title: 'Preflight a GitHub bounty',
      description:
        'Analyze a public GitHub bounty/paid issue before an AI agent spends compute. Checks payment signals, AI policy, competition, repository freshness and task clarity.',
      inputSchema: z.object({
        issue_url: z.string().url().describe('Public GitHub issue URL')
      })
    },
    async ({ issue_url }) => {
      const result = await analyzeIssueUrl(issue_url);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2)
          }
        ]
      };
    }
  );

  console.error('bounty-preflight MCP server running on stdio');
  return server;
});
