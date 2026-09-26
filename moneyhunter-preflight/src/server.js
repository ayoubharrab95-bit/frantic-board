import http from 'node:http';
import { analyzeIssueUrl } from './analyze.js';
import { runRadar } from './radar.js';

const port = Number(process.env.PORT || 8787);

function json(res, status, body) {
  const encoded = JSON.stringify(body, null, 2);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(encoded),
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'content-type, authorization',
    'access-control-allow-methods': 'GET,POST,OPTIONS'
  });
  res.end(encoded);
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
  const sources = (url.searchParams.get('sources') || 'frantic')
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
  if (req.method === 'OPTIONS') return json(res, 204, {});

  if (req.method === 'GET' && req.url === '/health') {
    return json(res, 200, {
      ok: true,
      service: 'moneyhunter-preflight',
      version: '0.2.0',
      features: ['github_preflight', 'opportunity_radar', 'mcp', 'x402_ready']
    });
  }

  if (req.method === 'POST' && req.url === '/v1/preflight') {
    try {
      const payload = await readJson(req);
      if (!payload.issue_url) {
        return json(res, 400, { error: 'issue_url is required' });
      }
      return json(res, 200, await analyzeIssueUrl(payload.issue_url));
    } catch (error) {
      return json(res, 422, {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  if (req.method === 'GET' && req.url?.startsWith('/v1/radar')) {
    try {
      const params = parseRadarQuery(req.url);
      const opportunities = await runRadar(params);
      return json(res, 200, {
        generated_at: new Date().toISOString(),
        filters: params,
        count: opportunities.length,
        opportunities
      });
    } catch (error) {
      return json(res, 502, {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  return json(res, 404, { error: 'not_found' });
});

server.listen(port, () => {
  console.error(`moneyhunter-preflight listening on http://localhost:${port}`);
});
