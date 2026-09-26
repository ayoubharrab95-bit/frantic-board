import { McpServer } from '@modelcontextprotocol/server';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import * as z from 'zod/v4';
import { analyzeIssueUrl } from './analyze.js';
import { runRadar } from './radar.js';

serveStdio(() => {
  const server = new McpServer({
    name: 'moneyhunter-preflight',
    version: '0.2.0'
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
    async ({ issue_url }) => ({
      content: [
        {
          type: 'text',
          text: JSON.stringify(await analyzeIssueUrl(issue_url), null, 2)
        }
      ]
    })
  );

  server.registerTool(
    'find_paid_opportunities',
    {
      title: 'Find paid AI-friendly opportunities',
      description:
        'Run the zero-LLM opportunity radar and return ranked live opportunities from supported public sources.',
      inputSchema: z.object({
        min_reward: z.number().min(0).default(5),
        limit: z.number().int().min(1).max(100).default(25)
      })
    },
    async ({ min_reward, limit }) => ({
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            await runRadar({ minReward: min_reward, limit }),
            null,
            2
          )
        }
      ]
    })
  );

  console.error('moneyhunter-preflight MCP server running on stdio');
  return server;
});
