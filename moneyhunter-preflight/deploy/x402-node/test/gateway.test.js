import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';

const PAY_TO = '0x8bdCC1064A9C373Ea4F2746BD8713aCf03Cf19ab';

async function withServer(config, fn) {
  const app = createApp({ PAY_TO, ...config });
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  try {
    const address = server.address();
    await fn(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

function decodePaymentRequired(res) {
  const header = res.headers.get('PAYMENT-REQUIRED') || res.headers.get('payment-required');
  assert.ok(header, 'PAYMENT-REQUIRED header must be present');
  return JSON.parse(Buffer.from(header, 'base64').toString('utf8'));
}

test('Base Sepolia health is configured and non-production', async () => {
  await withServer({ NETWORK: 'eip155:84532' }, async (base) => {
    const res = await fetch(`${base}/health`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.pay_to_configured, true);
    assert.equal(body.network, 'eip155:84532');
    assert.equal(body.adapter, 'express');
    assert.equal(body.production, false);
  });
});

test('Base Sepolia radar returns a valid x402 v2 challenge', async () => {
  await withServer({ NETWORK: 'eip155:84532' }, async (base) => {
    const res = await fetch(`${base}/v1/radar?min_reward=5&limit=1`);
    assert.equal(res.status, 402);
    const decoded = decodePaymentRequired(res);
    assert.equal(decoded.x402Version, 2);
    assert.equal(decoded.accepts?.[0]?.network, 'eip155:84532');
    assert.equal(decoded.accepts?.[0]?.payTo?.toLowerCase(), PAY_TO.toLowerCase());
    assert.equal(Number(decoded.accepts?.[0]?.amount), 100000);
  });
});

test('Base mainnet health reports production=true', async () => {
  await withServer({ NETWORK: 'eip155:8453' }, async (base) => {
    const res = await fetch(`${base}/health`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.network, 'eip155:8453');
    assert.equal(body.production, true);
    assert.equal(body.pay_to_configured, true);
  });
});

test('Base mainnet radar advertises real USDC price and recipient', async () => {
  await withServer({ NETWORK: 'eip155:8453' }, async (base) => {
    const res = await fetch(`${base}/v1/radar?min_reward=5&limit=1`);
    assert.equal(res.status, 402);
    const decoded = decodePaymentRequired(res);
    assert.equal(decoded.x402Version, 2);
    assert.equal(decoded.accepts?.[0]?.network, 'eip155:8453');
    assert.equal(decoded.accepts?.[0]?.payTo?.toLowerCase(), PAY_TO.toLowerCase());
    assert.equal(Number(decoded.accepts?.[0]?.amount), 100000);
  });
});

test('browser payment test is disabled on mainnet', async () => {
  await withServer({ NETWORK: 'eip155:8453' }, async (base) => {
    const res = await fetch(`${base}/test-payment`);
    assert.equal(res.status, 404);
    const body = await res.json();
    assert.equal(body.error, 'test_payment_disabled');
  });
});
