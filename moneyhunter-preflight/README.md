# MoneyHunter Bounty Preflight

MoneyHunter is a small **zero-LLM-first opportunity radar + bounty preflight API + MCP server**.

The goal is simple:

> Find paid work that is real, current, AI-compatible, low-competition, and worth spending agent compute on.

The project does **not** promise payment or acceptance. It reduces wasted compute and bad claims.

## v0.2 capabilities

### GitHub bounty preflight

Checks:

- issue still open
- repository alive / not archived
- reward amount / currency signals
- funded / escrowed vs proposed / unfunded / honeypot wording
- explicit AI permission or prohibition
- issue comments, assignment, claim signals and linked open PRs
- acceptance criteria, verification instructions and deliverable clarity
- repository freshness
- weighted `GO`, `REVIEW`, or `SKIP`

### Opportunity radar

The radar discovers live opportunities from supported sources without invoking an LLM.

Current source:

- Frantic public bounty board

Next adapters:

- Algora
- Opire
- GitHub paid-issue search
- direct-hire intake

The internal model is source-neutral so new adapters can be added without rewriting ranking logic.

## HTTP API

Node.js 20+:

```bash
npm install
npm start
```

Health:

```bash
curl http://localhost:8787/health
```

Analyze one GitHub bounty:

```bash
curl -X POST http://localhost:8787/v1/preflight \
  -H 'content-type: application/json' \
  -d '{"issue_url":"https://github.com/OWNER/REPO/issues/123"}'
```

Find opportunities:

```bash
curl 'http://localhost:8787/v1/radar?min_reward=5&limit=25'
```

For higher GitHub API limits, set `GITHUB_TOKEN` in the environment. Never commit it.

## CLI

```bash
npm run preflight -- https://github.com/OWNER/REPO/issues/123
npm run radar -- 5
```

## MCP

The project uses the stable v2 `@modelcontextprotocol/server` package.

```bash
npm install
npm run mcp
```

Tools:

- `preflight_github_bounty({ issue_url })`
- `find_paid_opportunities({ min_reward, limit })`

## Monetization scaffold

Launch pricing is stored in `product/pricing.json`.

Current draft prices:

- bounty preflight: **$0.05 / call**
- opportunity radar: **$0.10 / call**
- payment reliability: **$0.03 / call**

The `deploy/x402-proxy/` folder contains a Cloudflare Worker scaffold for an x402 pay-per-call gateway.

Safe deployment order:

1. deploy the free origin API
2. use `base-sepolia`
3. set only a public EVM receiving address
4. test with test USDC
5. verify settlement
6. switch to `base` only after successful tests

Never put a private key or recovery phrase in this repository.

## Hard-stop rules

Do not spend agent compute when:

- AI-generated submissions are explicitly prohibited
- reward is proposed/unfunded
- honeypot/bait language is present
- repository or issue is closed/archived
- competition is excessive
- payment credibility is poor
- the task requires unauthorized security testing

A `GO` still means platform-specific claim rules must be checked before any irreversible action or spending.

## Revenue-engine direction

MoneyHunter is intended to support four lanes:

1. funded external bounties
2. direct-hire agent work
3. paid API/MCP calls
4. marketplace/distribution integrations

External paid work has priority. When no strong opportunity exists, development effort improves the owned revenue asset instead of idling.
