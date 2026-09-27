import test from 'node:test';
import assert from 'node:assert/strict';
import { estimateExpectedValue, estimateAcceptanceProbability } from '../src/economics.js';

test('expected value subtracts spend and compute', () => {
  const result = estimateExpectedValue({
    rewardAmount: 20,
    acceptanceProbability: 0.8,
    estimatedMinutes: 30,
    requiredSpend: 1,
    hourlyComputeCost: 2
  });
  assert.equal(result.expected_profit_usd, 14);
  assert.equal(result.expected_hourly_usd, 28);
});

test('acceptance probability is bounded', () => {
  const p = estimateAcceptanceProbability({
    payment: 100, competition: 100, clarity: 100, ai_fit: 100, freshness: 100
  });
  assert.equal(p, 0.95);
});
