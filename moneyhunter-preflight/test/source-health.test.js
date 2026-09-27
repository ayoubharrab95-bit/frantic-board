import test from 'node:test';
import assert from 'node:assert/strict';
import { observeSourceStatus, filterAvailableSources, sourceHealth, clearSourceHealth } from '../src/source-health.js';

test('402 source enters cooldown and is excluded', () => {
  clearSourceHealth();
  observeSourceStatus('mya', { ok:false, error:'MYA HTTP 402' }, 1000);
  assert.deepEqual(filterAvailableSources(['github','mya'], 1000), ['github']);
  const row = sourceHealth(1000).find(x => x.source === 'mya');
  assert.equal(row.failure_kind, 'auth_or_payment');
  assert.equal(row.cooling_down, true);
});

test('healthy source clears cooldown state', () => {
  clearSourceHealth();
  observeSourceStatus('github', { ok:false, error:'HTTP 503' }, 1000);
  assert.deepEqual(filterAvailableSources(['github'], 1000), []);
  observeSourceStatus('github', { ok:true, found:3 }, 2000);
  assert.deepEqual(filterAvailableSources(['github'], 2000), ['github']);
  assert.equal(sourceHealth().find(x => x.source === 'github').state, 'healthy');
});
