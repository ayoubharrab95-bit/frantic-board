import test from 'node:test';
import assert from 'node:assert/strict';
import { enrichEconomics, choosePortfolio, buildStrategyPlan } from '../src/strategy.js';

test('economics rewards credible opportunities by expected hourly value', () => {
  const a = enrichEconomics({source:'frantic', reward:100, payment_confidence:0.9, competition_score:0.9, ai_policy:'allowed'});
  const b = enrichEconomics({source:'opire', reward:100, payment_confidence:0.25, competition_score:0.5, ai_policy:'unknown', requires_manual_payment:true});
  assert.ok(a.expected_hourly_usd > b.expected_hourly_usd);
  assert.ok(a.acceptance_probability <= 0.95);
});

test('portfolio keeps source diversity', () => {
  const rows = Array.from({length:6}, (_,i)=>({source:'github', expected_hourly_usd:100-i}))
    .concat([{source:'frantic',expected_hourly_usd:20},{source:'algora',expected_hourly_usd:19}]);
  const p=choosePortfolio(rows,{limit:5,maxPerSource:2});
  assert.equal(p.filter(x=>x.source==='github').length,2);
  assert.ok(p.some(x=>x.source==='frantic'));
  assert.ok(p.some(x=>x.source==='algora'));
});

test('strategy reports failed sources for self-improvement', () => {
  const p=buildStrategyPlan({opportunities:[],sourceStatus:{github:{ok:false,error:'rate limited'},frantic:{ok:true,found:0}}});
  assert.equal(p.strategy_revision,'0.5.0');
  assert.ok(p.source_actions.some(x=>x.source==='github'));
  assert.ok(p.source_actions.some(x=>x.source==='frantic'));
});
