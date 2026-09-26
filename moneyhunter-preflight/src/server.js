import http from 'node:http';
import { analyzeIssueUrl } from './analyze.js';

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

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return json(res, 204, {});

  if (req.method === 'GET' && req.url === '/health') {
    return json(res, 200, {
      ok: true,
      service: 'bounty-preflight',
      version: '0.1.0'
    });
  }

  if (req.method === 'POST' && req.url === '/v1/preflight') {
    try {
      const payload = await readJson(req);
      if (!payload.issue_url) {
        return json(res, 400, { error: 'issue_url is required' });
      }
      const result = await analyzeIssueUrl(payload.issue_url);
      return json(res, 200, result);
    } catch (error) {
      return json(res, 422, {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  return json(res, 404, { error: 'not_found' });
});

server.listen(port, () => {
  console.error(`bounty-preflight listening on http://localhost:${port}`);
});
