import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRevenuePlan, revenueLanes } from '../src/revenue-engine.js';

test('revenue engine exposes diversified lanes',()=>{
 const lanes=revenueLanes();
 assert.ok(lanes.length>=8);
 assert.ok(lanes.some(x=>x.model==='recurring'));
 assert.ok(lanes.some(x=>x.model==='usage_based'));
 assert.ok(lanes.some(x=>x.model==='one_off'));
});

test('revenue plan is sorted and never requires capital by default',()=>{
 const plan=buildRevenuePlan();
 assert.equal(plan[0].priority_score>=plan.at(-1).priority_score,true);
 assert.ok(plan.every(x=>x.capital_required===0));
});
