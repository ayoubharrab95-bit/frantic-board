import test from 'node:test';
import assert from 'node:assert/strict';
import { isZeroCapital, scoreZeroCapital, buildZeroCapitalPlan } from '../src/zero-capital-engine.js';

test('zero-capital policy rejects spending',()=>{
  assert.equal(isZeroCapital({requires_spending:true}),false);
  assert.equal(isZeroCapital({requires_manual_payment:true}),false);
  assert.equal(isZeroCapital({requires_wallet_signature:true}),false);
  assert.equal(isZeroCapital({requires_kyc:true}),false);
});

test('zero-capital scoring rewards verified repeatable work',()=>{
  const x=scoreZeroCapital({id:'x',reward:20,payment_confidence:.95,repeatability:.9,automation_score:.9,demand_score:.8,competition_score:.2});
  assert.equal(x.zero_capital,true);
  assert.ok(x.expected_zero_capital_value_usd>0);
  assert.ok(x.zero_capital_score>.7);
});

test('plan keeps only high-confidence no-spend opportunities',()=>{
  const p=buildZeroCapitalPlan([
    {id:'good',reward:10,payment_confidence:.9,repeatability:.8,claim_api_available:true},
    {id:'low',reward:10,payment_confidence:.4,repeatability:.8,claim_api_available:true},
    {id:'spend',reward:100,payment_confidence:1,requires_spending:true}
  ]);
  assert.equal(p.count,1);
  assert.equal(p.opportunities[0].id,'good');
});
