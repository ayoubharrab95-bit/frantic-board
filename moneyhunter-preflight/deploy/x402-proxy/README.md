# MoneyHunter x402 gateway

This Cloudflare Worker is the paid front door for the live MoneyHunter origin:

- origin: `https://moneyhunter-preflight.onrender.com`
- `POST /v1/preflight` — $0.05
- `GET /v1/radar` — $0.10
- `POST /v1/payment-reliability` — $0.03

The implementation uses the current x402 v2 packages:

- `@x402/core`
- `@x402/evm`
- `@x402/hono`

and the public facilitator at `https://x402.org/facilitator`.

## Network IDs

- Base Sepolia testnet: `eip155:84532`
- Base mainnet: `eip155:8453`

The repository defaults to Base Sepolia.

## What remains before deployment

Set `PAY_TO` to the **public 0x EVM receiving address** controlled by the operator. A private key or seed phrase is never needed by this receiving gateway.

Then:

```bash
npm install
npx wrangler dev
npx wrangler deploy
```

Test with test USDC first. Only move to `eip155:8453` after the 402 challenge, verification, settlement, and receipt path have all succeeded on testnet.

The Worker returns HTTP 503 instead of accepting payment when `PAY_TO` is not a valid EVM address.
