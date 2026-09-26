# MoneyHunter x402 Node gateway

A Render-compatible x402 paid gateway in front of the live MoneyHunter origin.

## Environment

- `NETWORK=eip155:84532` for Base Sepolia testnet
- `ORIGIN_URL=https://moneyhunter-preflight.onrender.com`
- `PAY_TO=<public EVM receiving address>`
- `PRICE_PREFLIGHT=$0.05`
- `PRICE_RADAR=$0.10`
- `PRICE_PAYMENT_RELIABILITY=$0.03`

No private key is used. `PAY_TO` is only the public receiving address.

## Production switch

After successful testnet challenge + payment + settlement tests:

`NETWORK=eip155:8453`

Do not switch to mainnet until settlement has been verified on Base Sepolia.
