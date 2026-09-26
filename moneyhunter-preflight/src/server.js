import http from 'node:http';
import { analyzeIssueUrl } from './analyze.js';
import { runRadar } from './radar.js';
import { PRICING, PUBLIC_MANIFEST, LLMS_TEXT, OPENAPI } from './product.js';
import {
  observeRequest,
  observePreflight,
  observeRadar,
  observePaymentCheck,
  snapshotMetrics
} from './observability.js';

const port = Number(process.env.PORT || 8787);

function baseHeaders(contentType) {
  return {
    'content-type': contentType,
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'content-type, authorization, payment-signature',
    'access-control-allow-methods': 'GET,POST,OPTIONS'
  };
}

function json(res, status, body, extra = {}) {
  const encoded = JSON.stringify(body, null, 2);
  res.writeHead(status, {
    ...baseHeaders('application/json; charset=utf-8'),
    'content-length': Buffer.byteLength(encoded),
    ...extra
  });
  res.end(encoded);
}

function text(res, status, body, contentType = 'text/plain; charset=utf-8') {
  res.writeHead(status, {
    ...baseHeaders(contentType),
    'content-length': Buffer.byteLength(body)
  });
  res.end(body);
}

async function readJson(req) {
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 64_000) throw new Error('Request body too large.');
  }
  return raw ? JSON.parse(raw) : {};
}

function parseRadarQuery(urlString = '/') {
  const url = new URL(urlString, 'http://localhost');
  const minReward = Number(url.searchParams.get('min_reward') || 5);
  const limit = Number(url.searchParams.get('limit') || 25);
  const sources = (url.searchParams.get('sources') || 'frantic,github,algora,opire')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  return {
    minReward: Number.isFinite(minReward) ? Math.max(0, minReward) : 5,
    limit: Number.isFinite(limit) ? Math.min(100, Math.max(1, limit)) : 25,
    sources
  };
}

const server = http.createServer(async (req, res) => {
  observeRequest();

  if (req.method === 'OPTIONS') return json(res, 204, {});

  if (req.method === 'GET' && req.url === '/') {
    return json(res, 200, PUBLIC_MANIFEST);
  }

  if (req.method === 'GET' && req.url === '/health') {
    return json(res, 200, {
      ok: true,
      service: 'moneyhunter-preflight',
      version: '0.4.1',
      features: PUBLIC_MANIFEST.features
    });
  }

  if (req.method === 'GET' && req.url === '/llms.txt') {
    return text(res, 200, LLMS_TEXT);
  }

  if (req.method === 'GET' && req.url === '/openapi.json') {
    return json(res, 200, OPENAPI);
  }

  if (req.method === 'GET' && req.url === '/v1/pricing') {
    return json(res, 200, PRICING, { 'cache-control': 'public, max-age=300' });
  }

  if (req.method === 'GET' && req.url === '/metrics') {
    return json(res, 200, snapshotMetrics(), { 'cache-control': 'no-store' });
  }

  if (req.method === 'POST' && req.url === '/v1/preflight') {
    const started = Date.now();
    try {
      const payload = await readJson(req);
      if (!payload.issue_url) {
        observePreflight({ ok: false, latencyMs: Date.now() - started });
        return json(res, 400, { error: 'issue_url is required' });
      }
      const result = await analyzeIssueUrl(payload.issue_url);
      observePreflight({ ok: true, latencyMs: Date.now() - started });
      return json(res, 200, result);
    } catch (error) {
      observePreflight({ ok: false, latencyMs: Date.now() - started });
      return json(res, 422, { error: error instanceof Error ? error.message : String(error) });
    }
  }

  if (req.method === 'POST' && req.url === '/v1/payment-reliability') {
    try {
      const payload = await readJson(req);
      if (!payload.issue_url) {
        observePaymentCheck({ ok: false });
        return json(res, 400, { error: 'issue_url is required' });
      }
      const result = await analyzeIssueUrl(payload.issue_url);
      observePaymentCheck({ ok: true });
      return json(res, 200, {
        source: result.source,
        reward: result.reward,
        payment: result.payment,
        recommendation: result.recommendation,
        red_flags: result.red_flags
      });
    } catch (error) {
      observePaymentCheck({ ok: false });
      return json(res, 422, { error: error instanceof Error ? error.message : String(error) });
    }
  }

  if (req.method === 'GET' && req.url?.startsWith('/v1/radar')) {
    const started = Date.now();
    try {
      const params = parseRadarQuery(req.url);
      const result = await runRadar(params);
      observeRadar({ ok: true, latencyMs: Date.now() - started });
      return json(res, 200, { filters: params, ...result });
    } catch (error) {
      observeRadar({ ok: false, latencyMs: Date.now() - started });
      return json(res, 502, { error: error instanceof Error ? error.message : String(error) });
    }
  }

  return json(res, 404, { error: 'not_found' });
});

server.listen(port, () => {
  console.error(`moneyhunter-preflight listening on http://localhost:${port}`);
});
