import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCapitalPlan } from '../src/capital-engine.js';

test('capital plan preserves a reserve', () => {
  const r = buildCapitalPlan({capitalUsd:5});
  assert.equal(r.buckets.reserve_usd,3.5);
  assert.equal(r.buckets.experiments_usd,0.5);
  assert.equal(r.buckets.working_usd,1);
  assert.ok(r.guardrails.includes('planning only'));
});
