export const PRICING = {
  currency: 'USD',
  settlement_target: 'x402',
  network: 'Base',
  tools: {
    bounty_preflight: {
      price_usd: 0.05,
      method: 'POST',
      path: '/v1/preflight'
    },
    opportunity_radar: {
      price_usd: 0.10,
      method: 'GET',
      path: '/v1/radar'
    },
    payment_reliability: {
      price_usd: 0.03,
      method: 'POST',
      path: '/v1/payment-reliability'
    }
  }
};

export const PUBLIC_MANIFEST = {
  name: 'MoneyHunter',
  version: '0.3.0',
  description: 'Zero-LLM-first paid-opportunity radar and bounty preflight for AI agents.',
  origin: 'https://moneyhunter-preflight.onrender.com',
  features: [
    'github_preflight',
    'payment_reliability',
    'multi_source_opportunity_radar',
    'frantic_adapter',
    'github_paid_issue_adapter',
    'algora_adapter',
    'opire_adapter',
    'mcp_stdio',
    'x402_ready',
    'agent_discovery'
  ],
  endpoints: {
    health: '/health',
    pricing: '/v1/pricing',
    preflight: '/v1/preflight',
    payment_reliability: '/v1/payment-reliability',
    radar: '/v1/radar',
    openapi: '/openapi.json',
    llms: '/llms.txt'
  },
  pricing: PRICING,
  disclaimer:
    'Scores are triage heuristics. They do not guarantee acceptance, payment, or legal/platform eligibility.'
};

export const LLMS_TEXT = `# MoneyHunter

MoneyHunter helps AI agents decide which paid software opportunities are worth attempting before they spend compute.

Origin: https://moneyhunter-preflight.onrender.com

## Free discovery
GET /
GET /health
GET /openapi.json
GET /v1/pricing

## Tools
POST /v1/preflight
Body: {"issue_url":"https://github.com/owner/repo/issues/123"}

POST /v1/payment-reliability
Body: {"issue_url":"https://github.com/owner/repo/issues/123"}

GET /v1/radar?min_reward=5&limit=25&sources=frantic,github,algora,opire

## Principles
- verify source-of-truth state before compute
- reject stale/unfunded/honeypot opportunities
- check AI policy before submission
- discount crowded work
- prefer credible settlement and clear acceptance criteria

Paid x402 routes are being prepared. Public scores are not guarantees.
`;

export const OPENAPI = {
  openapi: '3.1.0',
  info: {
    title: 'MoneyHunter API',
    version: '0.3.0',
    description: 'Paid-opportunity discovery and preflight for AI agents.'
  },
  servers: [{ url: 'https://moneyhunter-preflight.onrender.com' }],
  paths: {
    '/health': {
      get: {
        summary: 'Health check',
        responses: { '200': { description: 'Healthy' } }
      }
    },
    '/v1/pricing': {
      get: {
        summary: 'Current MoneyHunter launch pricing',
        responses: { '200': { description: 'Pricing manifest' } }
      }
    },
    '/v1/radar': {
      get: {
        summary: 'Rank live paid opportunities',
        parameters: [
          { name: 'min_reward', in: 'query', schema: { type: 'number', default: 5 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 25, maximum: 100 } },
          { name: 'sources', in: 'query', schema: { type: 'string', default: 'frantic,github,algora,opire' } }
        ],
        responses: { '200': { description: 'Ranked opportunities' } }
      }
    },
    '/v1/preflight': {
      post: {
        summary: 'Preflight one public GitHub bounty',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['issue_url'],
                properties: {
                  issue_url: { type: 'string', format: 'uri' }
                }
              }
            }
          }
        },
        responses: {
          '200': { description: 'Preflight report' },
          '422': { description: 'Invalid or unsupported issue' }
        }
      }
    },
    '/v1/payment-reliability': {
      post: {
        summary: 'Check payment/funding credibility for a GitHub bounty',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['issue_url'],
                properties: {
                  issue_url: { type: 'string', format: 'uri' }
                }
              }
            }
          }
        },
        responses: { '200': { description: 'Payment reliability report' } }
      }
    }
  }
};
