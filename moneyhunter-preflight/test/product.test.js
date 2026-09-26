import test from 'node:test';
import assert from 'node:assert/strict';
import { PRICING, PUBLIC_MANIFEST, OPENAPI, LLMS_TEXT } from '../src/product.js';

test('production pricing exposes all paid tools', () => {
  assert.equal(PRICING.currency, 'USDC');
  assert.equal(PRICING.network_id, 'eip155:8453');
  assert.equal(PRICING.tools.bounty_preflight.price_usd, 0.05);
  assert.equal(PRICING.tools.opportunity_radar.price_usd, 0.10);
  assert.equal(PRICING.tools.payment_reliability.price_usd, 0.03);
});

test('public manifest points to live discovery and paid origins', () => {
  assert.equal(PUBLIC_MANIFEST.free_origin, 'https://moneyhunter-preflight.onrender.com');
  assert.equal(PUBLIC_MANIFEST.paid_gateway, 'https://moneyhunter-x402-gateway.onrender.com');
  assert.equal(PUBLIC_MANIFEST.payments.status, 'live');
  assert.equal(PUBLIC_MANIFEST.payments.network_id, 'eip155:8453');
  assert.equal(OPENAPI.openapi, '3.1.0');
  assert.match(LLMS_TEXT, /Base mainnet/);
  assert.match(LLMS_TEXT, /x402 v2/);
});
