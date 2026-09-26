import test from 'node:test';
import assert from 'node:assert/strict';
import { parseAlgoraOrg, discoverAlgora } from '../src/sources/algora.js';
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
  assert.equal(rows[0].status, 'unverified');
});

test('Algora scans concurrently and keeps useful results when one organization fails', async () => {
  let active = 0;
  let peak = 0;
  const fetchImpl = async (url, options) => {
    assert.ok(options.signal, 'source requests must have a deadline');
    active++;
    peak = Math.max(peak, active);
    await new Promise((resolve) => setTimeout(resolve, 10));
    active--;
    if (url.includes('/broken/')) throw new Error('temporary outage');
    if (url.includes('api.github.com')) return {
      ok: true, json: async () => ({ state: 'open', html_url: url.replace('api.github.com/repos/', 'github.com/') })
    };
    const handle = url.split('/')[3];
    return { ok: true, text: async () => `<main>Open 1 $25 ${handle}#1 Fix docs 0 claims</main>` };
  };
  const result = await discoverAlgora({ orgs: ['first', 'broken', 'third', 'fourth', 'fifth'], fetchImpl });
  assert.ok(peak > 1 && peak <= 4);
  assert.deepEqual(result.map((item) => item.raw.org), ['first', 'third', 'fourth', 'fifth']);
});

test('Algora drops stale directory entries whose original GitHub issue is closed', async () => {
  const result = await discoverAlgora({ orgs: ['example'], fetchImpl: async (url) =>
    url.includes('api.github.com')
      ? { ok: true, json: async () => ({ state: 'closed' }) }
      : { ok: true, text: async () => '<main>$100 project#42 Fix a bug 0 claims</main>' }
  });
  assert.deepEqual(result, []);
});
