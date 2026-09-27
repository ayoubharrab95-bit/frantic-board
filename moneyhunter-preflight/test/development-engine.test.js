import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDevelopmentPlan, runDevelopmentCycle } from '../src/development-engine.js';

test('development plan selects a source repair when a source fails', async()=>{
  const p=await buildDevelopmentPlan({sourceStatus:{github:{ok:false,error:'timeout'}},executors:[]});
  assert.equal(p.selected.id,'repair-source');
  assert.equal(p.mode,'safe_self_development');
});

test('development cycle never crosses financial human gates', async()=>{
  const p=await runDevelopmentCycle({sourceStatus:{},executors:[]});
  assert.ok(p.human_gates.includes('wallet_signature'));
  assert.ok(p.human_gates.includes('spending'));
  assert.equal(p.result.status,'planned');
});
