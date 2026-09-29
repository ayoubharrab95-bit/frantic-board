import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyUsdcPayment } from '../src/treasury.js';
test('payment verifier rejects malformed transaction hashes',async()=>{const r=await verifyUsdcPayment({tx_hash:'bad',expected_amount_usdc:0.01});assert.equal(r.verified,false);assert.equal(r.reason,'invalid_tx_hash');});
