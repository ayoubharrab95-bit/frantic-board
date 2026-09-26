export const PRICING = {
  currency: 'USDC',
  settlement_target: 'x402',
  network: 'Base mainnet',
  network_id: 'eip155:8453',
  paid_gateway: 'https://moneyhunter-x402-gateway.onrender.com',
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
  version: '0.4.0',
  description: 'Zero-LLM-first paid-opportunity radar and bounty preflight for AI agents.',
  free_origin: 'https://moneyhunter-preflight.onrender.com',
  paid_gateway: PRICING.paid_gateway,
  payments: {
    protocol: 'x402 v2',
    network: PRICING.network,
    network_id: PRICING.network_id,
    currency: 'USDC',
    status: 'live'
  },
  features: [
    'github_preflight',
    'payment_reliability',
    'multi_source_opportunity_radar',
    'frantic_adapter',
    'github_paid_issue_adapter',
    'algora_adapter',
    'opire_adapter',
    'mcp_stdio',
    'x402_mainnet',
    'agent_discovery'
  ],
  endpoints: {
    free_health: 'https://moneyhunter-preflight.onrender.com/health',
    paid_health: 'https://moneyhunter-x402-gateway.onrender.com/health',
    paid_preflight: 'https://moneyhunter-x402-gateway.onrender.com/v1/preflight',
    paid_payment_reliability: 'https://moneyhunter-x402-gateway.onrender.com/v1/payment-reliability',
    paid_radar: 'https://moneyhunter-x402-gateway.onrender.com/v1/radar',
    pricing: 'https://moneyhunter-preflight.onrender.com/v1/pricing',
    openapi: 'https://moneyhunter-preflight.onrender.com/openapi.json',
    llms: 'https://moneyhunter-preflight.onrender.com/llms.txt'
  },
  pricing: PRICING,
  disclaimer:
    'Scores are triage heuristics. They do not guarantee acceptance, payment, or legal/platform eligibility.'
};

export const LLMS_TEXT = `# MoneyHunter

MoneyHunter helps AI agents find and preflight paid software opportunities before spending compute.

Free discovery origin: https://moneyhunter-preflight.onrender.com
Paid x402 gateway: https://moneyhunter-x402-gateway.onrender.com
Payment network: Base mainnet (eip155:8453)
Payment currency: USDC

## Discovery
GET https://moneyhunter-preflight.onrender.com/
GET https://moneyhunter-preflight.onrender.com/health
GET https://moneyhunter-preflight.onrender.com/openapi.json
GET https://moneyhunter-preflight.onrender.com/v1/pricing

## Paid tools
POST https://moneyhunter-x402-gateway.onrender.com/v1/preflight — $0.05 USDC
Body: {"issue_url":"https://github.com/owner/repo/issues/123"}

POST https://moneyhunter-x402-gateway.onrender.com/v1/payment-reliability — $0.03 USDC
Body: {"issue_url":"https://github.com/owner/repo/issues/123"}

GET https://moneyhunter-x402-gateway.onrender.com/v1/radar?min_reward=5&limit=25&sources=frantic,github,algora,opire — $0.10 USDC

Paid routes use x402 v2. An unpaid request receives HTTP 402 with PAYMENT-REQUIRED describing the Base mainnet USDC payment.

## Principles
- verify source-of-truth state before compute
- reject stale/unfunded/honeypot opportunities
- check AI policy before submission
- discount crowded work
- prefer credible settlement and clear acceptance criteria

Scores are triage heuristics, not guarantees.
`;

export const OPENAPI = {
  openapi: '3.1.0',
  info: {
    title: 'MoneyHunter API',
    version: '0.4.0',
    description: 'Paid-opportunity discovery and preflight for AI agents with x402 USDC payment on Base.'
  },
  servers: [
    {
      url: 'https://moneyhunter-x402-gateway.onrender.com',
      description: 'Production x402 gateway — Base mainnet USDC'
    },
    {
      url: 'https://moneyhunter-preflight.onrender.com',
      description: 'Free discovery/origin service'
    }
  ],
  paths: {
    '/health': {
      get: {
        summary: 'Health check',
        responses: { '200': { description: 'Healthy' } }
      }
    },
    '/v1/pricing': {
      get: {
        summary: 'Current MoneyHunter pricing',
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
        responses: {
          '200': { description: 'Ranked opportunities after successful x402 payment on the paid gateway' },
          '402': { description: 'Payment required; inspect PAYMENT-REQUIRED header for x402 v2 terms' }
        }
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
          '200': { description: 'Preflight report after successful x402 payment on the paid gateway' },
          '402': { description: 'Payment required' },
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
        responses: {
          '200': { description: 'Payment reliability report after successful x402 payment' },
          '402': { description: 'Payment required' }
        }
      }
    }
  }
};
