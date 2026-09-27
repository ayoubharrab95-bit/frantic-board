import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeLedger } from '../src/revenue-memory.js';

test('revenue memory summarizes acceptance, payout and realized hourly rate',()=>{
 const rows=[
  {source:'taskbounty',accepted:true,paid:true,payout_usd:50,effort_minutes:60},
  {source:'taskbounty',accepted:false,paid:false,payout_usd:0,effort_minutes:30},
  {source:'mya',accepted:true,paid:true,payout_usd:25,effort_minutes:30}
 ];
 const s=summarizeLedger(rows);
 const t=s.find(x=>x.source==='taskbounty');
 assert.equal(t.attempts,2);assert.equal(t.acceptance_rate,.5);assert.equal(t.payment_rate,.5);assert.equal(t.realized_hourly_usd,50);
});
