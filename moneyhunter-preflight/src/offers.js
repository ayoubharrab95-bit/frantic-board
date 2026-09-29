export const OFFERS = [
  {
    id: 'direct-bounty-preflight',
    channel: 'direct-hire',
    type: 'service',
    name: 'Bounty Preflight',
    price_from_usd: 5,
    delivery: 'AI-agent-ready report',
    description: 'Verify a public paid software opportunity for funding, competition, AI policy, acceptance criteria and payment risk.'
  },
  {
    id: 'repo-quality-review',
    channel: 'direct-hire',
    type: 'service',
    name: 'Repository Quality Review',
    price_from_usd: 10,
    delivery: 'automated report',
    description: 'Review a public repository for test health, stale issues, risky dependencies and contribution readiness.'
  },
  {
    id: 'small-github-contribution',
    channel: 'direct-hire',
    type: 'service',
    name: 'Small GitHub Contribution',
    price_from_usd: 15,
    delivery: 'tested PR',
    description: 'Small documentation, test, bug-fix or integration contribution where the repository permits AI-assisted work.'
  },
  {
    id: 'web-data-extraction',
    channel: 'direct-hire',
    type: 'service',
    name: 'Web Data Extraction',
    price_from_usd: 5,
    delivery: 'structured JSON/CSV',
    description: 'Extract and normalize publicly accessible web data into a validated machine-readable dataset.'
  },
  {
    id: 'research-brief',
    channel: 'direct-hire',
    type: 'service',
    name: 'Research Brief',
    price_from_usd: 5,
    delivery: 'source-backed report',
    description: 'Research a defined question, collect sources, normalize findings and return a concise evidence-backed brief.'
  },
  {
    id: 'qa-regression-pack',
    channel: 'direct-hire',
    type: 'service',
    name: 'QA Regression Pack',
    price_from_usd: 10,
    delivery: 'test report + reproduction',
    description: 'Reproduce a reported issue, add deterministic regression coverage and document verification steps.'
  },
  {
    id: 'api-integration-small',
    channel: 'direct-hire',
    type: 'service',
    name: 'Small API Integration',
    price_from_usd: 20,
    delivery: 'tested integration',
    description: 'Implement a bounded API/webhook integration with tests and a concise runbook.'
  },
  {
    id: 'moneyhunter-mcp',
    channel: 'reusable-assets',
    type: 'developer_asset',
    name: 'MoneyHunter MCP',
    price_from_usd: 9,
    delivery: 'MCP integration',
    description: 'Connect an AI agent to paid-opportunity preflight, radar and payment-reliability capabilities.'
  },
  {
    id: 'bounty-radar-template',
    channel: 'reusable-assets',
    type: 'developer_asset',
    name: 'Bounty Radar Starter',
    price_from_usd: 19,
    delivery: 'source-adapter starter',
    description: 'Reusable zero-LLM-first opportunity radar architecture with scoring, deduplication and hard safety gates.'
  },
  {
    id: 'x402-agent-api-starter',
    channel: 'reusable-assets',
    type: 'developer_asset',
    name: 'x402 Agent API Starter',
    price_from_usd: 29,
    delivery: 'API starter',
    description: 'Reusable pattern for exposing an agent-facing API with x402 USDC payment and machine-readable discovery metadata.'
  }
];

export function revenueOffers() {
  return OFFERS.map(x => ({ ...x }));
}
