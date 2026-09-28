# MoneyHunter

MoneyHunter is a **zero-LLM-first paid-opportunity radar + bounty preflight API + MCP server** for AI agents.

Live origin:

`https://moneyhunter-preflight.onrender.com`

The goal is simple:

> Find work that is real, current, AI-compatible, low-competition, and worth spending agent compute on — while building an owned pay-per-call revenue asset when external work is quiet.

MoneyHunter does **not** promise payment, acceptance, or daily income. It reduces wasted compute and bad claims.

## v0.6 capabilities

### 1. GitHub bounty preflight

Checks:

- issue still open
- repository alive / not archived
- reward amount / currency signals
- funded / escrowed vs proposed / unfunded / honeypot wording
- explicit AI permission or prohibition
- comments, assignment, claim signals and linked open PRs
- acceptance criteria, verification instructions and deliverable clarity
- repository freshness
- weighted `GO`, `REVIEW`, or `SKIP`

### 2. Multi-source opportunity radar

Adapters currently present:

- Frantic
- GitHub paid-issue search
- Algora
- Opire

The radar is zero-LLM-first, applies payment/competition/AI discounts, computes an expected-value estimate, deduplicates, and caches short-lived results to avoid wasting rate limits.

Directory listings are leads, not payable work by themselves. Algora entries are included only when the original GitHub issue can be checked live and remains open. Opire home cards lack a reliable canonical issue URL, so they are marked `unverified` and excluded from the open radar until a detail-page verification is implemented. Upstream requests have deadlines and Algora organizations are checked with bounded concurrency; partial source failures are reported in `source_status`.

### 3. Payment reliability

A focused endpoint returns:

- detected reward
- funding/payment signals
- payment-confidence score
- hard-stop warnings
- recommendation

### 4. Agent discovery

Public discovery endpoints:

- `GET /`
- `GET /health`
- `GET /llms.txt`
- `GET /openapi.json`
- `GET /v1/pricing`
- `GET /metrics`

### 5. MCP

Tools:

- `preflight_github_bounty({ issue_url })`
- `find_paid_opportunities({ min_reward, limit })`
- `check_payment_reliability({ issue_url })`
- `moneyhunter_pricing({})`

The project uses the stable v2 `@modelcontextprotocol/server` package.

## HTTP examples

Health:

```bash
curl https://moneyhunter-preflight.onrender.com/health
```

Analyze one GitHub bounty:

```bash
curl -X POST https://moneyhunter-preflight.onrender.com/v1/preflight \
  -H 'content-type: application/json' \
  -d '{"issue_url":"https://github.com/OWNER/REPO/issues/123"}'
```

Check payment reliability:

```bash
curl -X POST https://moneyhunter-preflight.onrender.com/v1/payment-reliability \
  -H 'content-type: application/json' \
  -d '{"issue_url":"https://github.com/OWNER/REPO/issues/123"}'
```

Find opportunities:

```bash
curl 'https://moneyhunter-preflight.onrender.com/v1/radar?min_reward=5&limit=25&sources=frantic,github,algora,opire'
```

Pricing:

```bash
curl https://moneyhunter-preflight.onrender.com/v1/pricing
```

For higher GitHub API limits, set `GITHUB_TOKEN` in the runtime environment. Never commit it.

## Local run

Node.js 20+:

```bash
npm install
npm start
```

`npm install` runs syntax checks and unit tests through the `postinstall` verification gate. A failed test blocks deployment.

CLI:

```bash
npm run preflight -- https://github.com/OWNER/REPO/issues/123
npm run radar -- 5
```

MCP:

```bash
npm run mcp
```

## Monetization

Production x402 prices on **Base mainnet (eip155:8453)**:

- bounty preflight: **$0.05 / call**
- opportunity radar: **$0.10 / call**
- payment reliability: **$0.03 / call**

Production paid gateway: `https://moneyhunter-x402-gateway.onrender.com`\n\nThe active Node gateway uses `@x402/core`, `@x402/evm`, and the official Express adapter. It settles USDC through x402 v2 on Base mainnet.

Production status:

1. free origin API live on Render ✅
2. Base Sepolia 402 challenge tested ✅
3. test-USDC signature and settlement completed end-to-end ✅
4. receiving EVM address configured ✅
5. production gateway switched to Base mainnet `eip155:8453` ✅
6. browser test-payment route disabled on mainnet ✅
7. paid API discovery metadata published ✅

The remaining growth work is distribution: getting the live paid API/MCP in front of more agents and continuing external paid-work hunting.

No private key or seed phrase is required for receiving API payments.

## Direct-hire offers

Productized offers are documented in `product/direct-hire.md`:

- bounty preflight — from $5
- repository quality review — from $10
- small GitHub contribution — from $15

These are designed for AI-friendly platforms only; no spam outreach and no AI-prohibited submissions.

## Hard-stop rules

Do not spend agent compute when:

- AI-generated submissions are explicitly prohibited
- reward is proposed/unfunded
- honeypot/bait language is present
- repository or issue is closed/archived
- competition is excessive
- payment credibility is poor
- task requires unauthorized security testing
- task requires unapproved user spending or wallet signing

## Revenue engine

Priority order:

1. funded external paid work
2. direct-hire agent work
3. paid API/MCP calls
4. marketplace/distribution
5. improve the owned asset whenever no better external work is available

This keeps the system productive even when bounty boards are quiet.


### MONEY MODE (v0.6)

The default hunting mode is now crypto-first and payout-gated. An opportunity is eligible for automatic execution only when its payout is explicitly verified as receivable by the configured public EVM treasury address (MetaMask-compatible), has sufficient payment confidence, and does not require spending or a wallet signature. MetaMask supports Base and other EVM networks; MoneyHunter currently uses Base USDC as its first-class payout rail and records confirmed income separately from pending/expected value.

Set only the public receiving address:

- `TREASURY_BASE_ADDRESS=0x...`
- Never provide a seed phrase or private key for receiving payouts.

### Autonomous cadence

When `AUTO_HUNT=true`, the hunter runs every **15 minutes** (minimum interval 15m) and the service emits an hourly income/attempt report. The web service exposes `/v1/money-mode`, `/v1/hourly-report`, and `/v1/system-state` for monitoring.

TinyFish is not part of the active executor registration. API/HTTP/GitHub paths remain the preferred execution routes.
