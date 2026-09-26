import { McpServer } from '@modelcontextprotocol/server';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import * as z from 'zod/v4';
import { analyzeIssueUrl } from './analyze.js';
import { runRadar } from './radar.js';
import { PRICING } from './product.js';

serveStdio(() => {
  const server = new McpServer({
    name: 'moneyhunter-preflight',
    version: '0.3.0'
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
      content: [{ type: 'text', text: JSON.stringify(await analyzeIssueUrl(issue_url), null, 2) }]
    })
  );

  server.registerTool(
    'find_paid_opportunities',
    {
      title: 'Find paid AI-friendly opportunities',
      description:
        'Run the zero-LLM opportunity radar and return ranked live opportunities from Frantic, GitHub, Algora and Opire.',
      inputSchema: z.object({
        min_reward: z.number().min(0).default(5),
        limit: z.number().int().min(1).max(100).default(25)
      })
    },
    async ({ min_reward, limit }) => ({
      content: [{
        type: 'text',
        text: JSON.stringify(await runRadar({ minReward: min_reward, limit }), null, 2)
      }]
    })
  );

  server.registerTool(
    'check_payment_reliability',
    {
      title: 'Check bounty payment reliability',
      description:
        'Return the payment/funding signals and hard-stop warnings for one public GitHub bounty.',
      inputSchema: z.object({
        issue_url: z.string().url().describe('Public GitHub issue URL')
      })
    },
    async ({ issue_url }) => {
      const result = await analyzeIssueUrl(issue_url);
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            source: result.source,
            reward: result.reward,
            payment: result.payment,
            recommendation: result.recommendation,
            red_flags: result.red_flags
          }, null, 2)
        }]
      };
    }
  );

  server.registerTool(
    'moneyhunter_pricing',
    {
      title: 'MoneyHunter API pricing',
      description: 'Return the current draft pay-per-call prices for MoneyHunter services.',
      inputSchema: z.object({})
    },
    async () => ({
      content: [{ type: 'text', text: JSON.stringify(PRICING, null, 2) }]
    })
  );

  console.error('moneyhunter-preflight MCP server running on stdio');
  return server;
});
