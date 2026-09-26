# Bounty Preflight

A small API + MCP tool that answers one question before an AI coding agent spends compute:

> **Is this paid GitHub opportunity actually worth attempting?**

It checks the live GitHub source of truth instead of trusting bounty mirrors.

## What v0.1 checks

- issue is still open
- repository is alive / not archived
- reward amount and payout currency signals
- funded/escrowed vs proposed/unfunded/honeypot language
- explicit AI-agent permission or prohibition
- issue comments, assignment, claim signals and linked open PRs
- acceptance criteria, verification instructions and deliverable clarity
- repository freshness
- a weighted priority score and `GO`, `REVIEW`, or `SKIP` recommendation

The score is a triage heuristic, **not a guarantee of payment or acceptance**.

## HTTP API

Node.js 20+:

```bash
npm install
cp .env.example .env
npm start
```

Health:

```bash
curl http://localhost:8787/health
```

Analyze a bounty:

```bash
curl -X POST http://localhost:8787/v1/preflight \
  -H 'content-type: application/json' \
  -d '{"issue_url":"https://github.com/OWNER/REPO/issues/123"}'
```

For reliable GitHub API limits, set `GITHUB_TOKEN` in the environment. Never commit the token.

## CLI

```bash
node src/cli.js https://github.com/OWNER/REPO/issues/123
```

## MCP

Uses the current v2 MCP TypeScript server package.

```bash
npm install
npm run mcp
```

It exposes:

- `preflight_github_bounty({ issue_url })`

## Safety / anti-spam rules

Hard stop signals include:

- AI-generated submissions explicitly prohibited
- proposed or unfunded rewards
- honeypot/bait language
- archived or closed work
- heavy claim/PR competition

A `GO` still means: verify platform-specific claim rules before an irreversible action or before spending the operator's funds.

## Roadmap

- Frantic adapter
- Algora adapter
- Opire adapter
- payout-history / settlement reliability scoring
- cross-platform deduplication
- cached zero-LLM radar
- x402 pay-per-call endpoint for third-party agents
- autonomous hunter integration: discover → preflight → claim → execute → verify → submit → settlement watch
