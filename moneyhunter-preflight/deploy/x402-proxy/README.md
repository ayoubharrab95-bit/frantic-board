# MoneyHunter x402 gateway

This Cloudflare Worker puts an x402 paywall in front of the MoneyHunter HTTP API.

Launch defaults:

- `POST /v1/preflight` — $0.05
- `GET /v1/radar` — $0.10

## Safe deployment sequence

1. Deploy the core MoneyHunter HTTP API and set `ORIGIN_URL`.
2. Keep `NETWORK=base-sepolia` while testing.
3. Set `PAY_TO` to a public EVM wallet address you control.
4. Run test payments with test USDC.
5. Only after successful settlement tests, change `NETWORK` to `base`.

Never put a private key or seed phrase in this repository. Receiving payments only requires the public wallet address.

The gateway uses the standard x402 `402 Payment Required` flow and a facilitator. The operator should independently confirm current facilitator and network settings before production deployment.
