import test from 'node:test';
import assert from 'node:assert/strict';
import { revenueOffers } from '../src/offers.js';

test('revenue catalog contains repeatable and direct-hire offers', () => {
  const offers = revenueOffers();
  assert.ok(offers.length >= 5);
  assert.ok(offers.some(x => x.channel === 'direct-hire'));
  assert.ok(offers.some(x => x.channel === 'reusable-assets'));
  assert.ok(offers.every(x => Number(x.price_from_usd) > 0));
});
