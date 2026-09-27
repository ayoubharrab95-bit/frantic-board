import test from 'node:test';
import assert from 'node:assert/strict';
import {
  scoreCompetition,
  scoreFreshness,
  combineScores,
  chooseRecommendation
} from '../src/scoring.js';

test('competition score drops with claims and PRs', () => {
  const clean = scoreCompetition({
    comments: 1,
    assignees: 0,
    linkedOpenPrs: 0,
    claimSignals: 0
  });
  const crowded = scoreCompetition({
    comments: 30,
    assignees: 1,
    linkedOpenPrs: 3,
    claimSignals: 8
  });
  assert.ok(clean > crowded);
  assert.ok(crowded <= 10);
});

test('archived repos have zero freshness', () => {
  assert.equal(
    scoreFreshness({
      archived: true,
      pushed_at: new Date().toISOString()
    }),
    0
  );
});

test('GO needs a healthy total and concrete reward', () => {
  const total = combineScores({
    payment: 90,
    competition: 95,
    clarity: 90,
    ai: 100,
    freshness: 100,
    reward: { amount: 25 }
  });

  assert.equal(
    chooseRecommendation({
      issueState: 'open',
      archived: false,
      aiStatus: 'allowed',
      paymentWarnings: [],
      total,
      reward: { amount: 25 }
    }),
    'GO'
  );
});

test('AI-prohibited work is always skipped', () => {
  assert.equal(
    chooseRecommendation({
      issueState: 'open',
      archived: false,
      aiStatus: 'prohibited',
      paymentWarnings: [],
      total: 99,
      reward: { amount: 100 }
    }),
    'SKIP'
  );
});
