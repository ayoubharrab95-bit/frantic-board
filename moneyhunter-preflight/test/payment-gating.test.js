import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyPaymentState } from '../src/sources/github-paid.js';

test('unknown payment remains discoverable and is not treated as manual payment', () => {
  const result = classifyPaymentState({ text: 'Reward: $50 USD', paymentScore: 25 });
  assert.equal(result.state, 'unknown');
  assert.equal(result.requiresManualPayment, false);
});

test('escrow evidence is a distinct payment state', () => {
  const result = classifyPaymentState({ text: 'Reward: $50. Escrow locked.', paymentScore: 60 });
  assert.equal(result.state, 'escrow');
  assert.equal(result.requiresManualPayment, false);
});

test('explicit manual payout is gated', () => {
  const result = classifyPaymentState({ text: 'Reward: $50. Invoice required after acceptance.', paymentScore: 60 });
  assert.equal(result.state, 'manual');
  assert.equal(result.requiresManualPayment, true);
});

test('spending or wallet actions are always gated', () => {
  const result = classifyPaymentState({ text: 'Reward: $5 USDC. Pay the x402 challenge.', paymentScore: 95, requiresSpending: true });
  assert.equal(result.state, 'spending_required');
  assert.equal(result.requiresManualPayment, true);
});
