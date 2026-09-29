import test from 'node:test';
import assert from 'node:assert/strict';
import { paidJobCatalog } from '../src/paid-jobs.js';
test('paid job catalog declares Base USDC settlement',()=>{const c=paidJobCatalog();assert.ok(c.length>0);for(const x of c){assert.equal(x.payment.asset,'USDC');assert.equal(x.payment.network,'Base');assert.equal(x.payment.network_id,'eip155:8453');}});
