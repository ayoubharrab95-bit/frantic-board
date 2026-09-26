import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';

const PAY_TO = '0x8bdCC1064A9C373Ea4F2746BD8713aCf03Cf19ab';

async function withServer(fn) {
  const app = createApp({ PAY_TO, NETWORK: 'eip155:84532' });
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  try {
    const address = server.address();
    await fn(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test('health reports Express adapter and configured payee', async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/health`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.pay_to_configured, true);
    assert.equal(body.network, 'eip155:84532');
    assert.equal(body.adapter, 'express');
  });
});

test('protected radar returns x402 challenge without payment', async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/v1/radar?min_reward=5&limit=1`);
    assert.equal(res.status, 402);
    const header = res.headers.get('PAYMENT-REQUIRED') || res.headers.get('payment-required');
    assert.ok(header, 'PAYMENT-REQUIRED header must be present');
    const decoded = JSON.parse(Buffer.from(header, 'base64').toString('utf8'));
    assert.equal(decoded.x402Version, 2);
    assert.equal(decoded.accepts?.[0]?.network, 'eip155:84532');
    assert.equal(decoded.accepts?.[0]?.payTo?.toLowerCase(), PAY_TO.toLowerCase());
    assert.ok(Number(decoded.accepts?.[0]?.amount) > 0);
  });
});
