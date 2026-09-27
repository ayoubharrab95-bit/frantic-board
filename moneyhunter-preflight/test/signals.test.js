import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractReward,
  detectPaymentSignals,
  detectAiPolicy,
  detectClarity
} from '../src/signals.js';

test('extracts a stablecoin bounty amount', () => {
  assert.deepEqual(
    extractReward('[AGENT-TASK] Fix cache', 'Reward: $15 USDC logged on merge'),
    { amount: 15, currency: 'USDC', evidence: 'Reward: $15 USDC' }
  );
});

test('flags proposed/unfunded rewards', () => {
  const result = detectPaymentSignals(
    'Bounty proposal',
    'Proposed Reward: $50 USD. Funding is being prepared.'
  );
  assert.ok(result.score < 30);
  assert.ok(result.warnings.length > 0);
});

test('recognizes explicit funded and paid evidence', () => {
  const paid = detectPaymentSignals('bounty', 'paid: true; payment on merge');
  assert.ok(paid.score >= 75);
  const claimants = detectPaymentSignals('bounty', 'multiple distinct claimants have been paid');
  assert.ok(claimants.score >= 55);
});

test('detects explicit AI permission', () => {
  const result = detectAiPolicy(
    'Task',
    'This issue is ai-agent-friendly. AI coding assistants are welcome to attempt and submit PRs.'
  );
  assert.equal(result.status, 'allowed');
});

test('detects explicit AI prohibition', () => {
  const result = detectAiPolicy(
    'Task',
    'AI-generated submissions are prohibited.'
  );
  assert.equal(result.status, 'prohibited');
});

test('scores clear acceptance criteria highly', () => {
  const result = detectClarity(
    'Acceptance Criteria\n- tests pass\nHow to verify: npm test\nExpected Output: src/a.ts\nHow to claim: open a PR'
  );
  assert.equal(result.score, 100);
});
