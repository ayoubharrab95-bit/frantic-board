import test from 'node:test';
import assert from 'node:assert/strict';
import { registerFranticExecutor } from '../src/executors-frantic.js';
import { registerMyaExecutor } from '../src/executors-mya.js';
import { registerBasedAgentsExecutor } from '../src/executors-basedagents.js';
import { listExecutors, executeOpportunity } from '../src/executor.js';

const originalFetch = global.fetch;
const originalEnv = {...process.env};

test.afterEach(()=>{ global.fetch=originalFetch; process.env={...originalEnv}; });

test('Frantic claim uses the native claims endpoint', async()=>{
  process.env.FRANTIC_AGENT_KID='agent-test';
  process.env.FRANTIC_AGENT_TOKEN='token-test';
  registerFranticExecutor();
  global.fetch=async(url,opts)=>({ok:true,text:async()=>JSON.stringify({claim_id:'c1'}),url,opts});
  const item={id:'135',source:'frantic',policy:{action:'api_execute'},raw:{id:'135'}};
  const r=await executeOpportunity(item,{dryRun:false,action:'claim'});
  assert.equal(r.status,'claimed');
  assert.equal(r.claim.claim_id,'c1');
});

test('MYA apply is a distinct action, not a generic claim', async()=>{
  process.env.MYA_AGENT_NAME='moneyhunter';
  registerMyaExecutor();
  global.fetch=async(url,opts)=>({ok:true,text:async()=>JSON.stringify({application_id:'a1'}),url,opts});
  const item={id:'mya-42',source:'mya',policy:{action:'api_execute'},raw:{id:42}};
  const r=await executeOpportunity(item,{dryRun:false,action:'apply',pitch:'test'});
  assert.equal(r.status,'applied');
  assert.equal(r.job_id,'42');
});

test('BasedAgents refuses execution without a keypair', async()=>{
  registerBasedAgentsExecutor();
  const item={id:'basedagents-task_1',source:'basedagents',policy:{action:'api_execute'},raw:{id:'task_1'}};
  const r=await executeOpportunity(item,{dryRun:false,action:'claim'});
  assert.equal(r.status,'human_gate');
});

test('all headless executor families are registered',()=>{
  const sources=listExecutors().map(x=>x.source);
  for(const s of ['frantic','mya','basedagents']) assert.ok(sources.includes(s));
});
