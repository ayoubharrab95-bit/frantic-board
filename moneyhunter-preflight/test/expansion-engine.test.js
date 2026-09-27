import test from 'node:test';
import assert from 'node:assert/strict';
import { buildExpansionPlan } from '../src/expansion-engine.js';

test('expansion plan prefers scalable channels and preserves guardrails', () => {
  const r = buildExpansionPlan({ capitalUsd:5 });
  assert.equal(r.current_capital_usd,5);
  assert.ok(r.channels.length >= 5);
  assert.ok(r.stop_conditions.length >= 4);
  assert.ok(r.channels.some(x=>x.mode==='bootstrap'));
});

test('learning metrics use recorded outcomes', () => {
  const r = buildExpansionPlan({ capitalUsd:50, outcomes:[{success:true},{success:false},{success:true}] });
  assert.equal(r.learning.successes,2);
  assert.equal(r.learning.failures,1);
  assert.equal(r.learning.observed_success_rate,2/3);
});
