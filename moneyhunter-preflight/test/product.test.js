import test from 'node:test';
import assert from 'node:assert/strict';
import { PRICING, PUBLIC_MANIFEST, OPENAPI, LLMS_TEXT } from '../src/product.js';

test('launch pricing exposes all paid tools', () => {
  assert.equal(PRICING.tools.bounty_preflight.price_usd, 0.05);
  assert.equal(PRICING.tools.opportunity_radar.price_usd, 0.10);
  assert.equal(PRICING.tools.payment_reliability.price_usd, 0.03);
});

test('public manifest points to the live origin', () => {
  assert.equal(PUBLIC_MANIFEST.origin, 'https://moneyhunter-preflight.onrender.com');
  assert.equal(OPENAPI.openapi, '3.1.0');
  assert.match(LLMS_TEXT, /MoneyHunter/);
});
