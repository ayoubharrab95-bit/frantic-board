import test from 'node:test';
import assert from 'node:assert/strict';
import { parseAlgoraOrg } from '../src/sources/algora.js';
import { parseOpireHome } from '../src/sources/opire.js';

test('parses Algora bounty rows and claim counts', () => {
  const html = '<main>Open 2 $100 nuclei#6674 Replace panic with error handling 33 claims $20 highlight#8032 document backend instrumentation 26 claims</main>';
  const rows = parseAlgoraOrg('projectdiscovery', html);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].reward, 100);
  assert.equal(rows[0].active_claims, 33);
  assert.equal(rows[0].source, 'algora');
});

test('parses Opire visible reward cards conservatively', () => {
  const html = '<main>microg GmsCore 23/04/2026 [BOUNTY] RCS Support Java Command available $1,900.00 6 solvers</main>';
  const rows = parseOpireHome(html);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].reward, 1900);
  assert.equal(rows[0].active_claims, 6);
  assert.equal(rows[0].requires_manual_payment, true);
});
