import crypto from 'node:crypto';
import { registerExecutor } from './executor.js';

function base64Url(buf) {
  return Buffer.from(buf).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}
function bodyHash(body) {
  return crypto.createHash('sha256').update(body).digest('hex');
}
function privateKeyFromEnv() {
  const value = process.env.BASEDAGENTS_PRIVATE_KEY_PEM || process.env.BASEDAGENTS_PRIVATE_KEY_HEX;
  if (!value) return null;
  if (value.includes('BEGIN')) return crypto.createPrivateKey(value);
  const hex = value.replace(/^0x/, '').trim();
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) throw new Error('BASEDAGENTS_PRIVATE_KEY_HEX must contain a 32-byte Ed25519 seed');
  const seed = Buffer.from(hex, 'hex');
  const der = Buffer.concat([
    Buffer.from('302e020100300506032b657004220420', 'hex'),
    seed
  ]);
  return crypto.createPrivateKey({ key: der, format: 'der', type: 'pkcs8' });
}
function sign(method, path, timestamp, body, nonce) {
  const key = privateKeyFromEnv();
  const pub = process.env.BASEDAGENTS_PUBLIC_KEY_B58;
  if (!key || !pub) return null;
  const message = `${method}:${path}:${timestamp}:${bodyHash(body)}:${nonce}`;
  const signature = crypto.sign(null, Buffer.from(message), key);
  return {
    authorization: `AgentSig ${pub}:${base64Url(signature)}`,
    timestamp: String(timestamp),
    nonce
  };
}
async function request(path, method, body = '') {
  const auth = sign(method, path, Math.floor(Date.now() / 1000), body, crypto.randomUUID());
  if (!auth) return { status: 'human_gate', reason: 'BASEDAGENTS_AGENT_KEYPAIR_missing' };
  const res = await fetch(`https://api.basedagents.ai${path}`, {
    method,
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      'user-agent': 'moneyhunter-preflight/0.7',
      Authorization: auth.authorization,
      'X-Timestamp': auth.timestamp,
      'X-Nonce': auth.nonce
    },
    body
  });
  const raw = await res.text();
  let parsed; try { parsed = raw ? JSON.parse(raw) : {}; } catch { parsed = { raw }; }
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${parsed?.error || parsed?.message || raw.slice(0, 300)}`);
  return parsed;
}

export function registerBasedAgentsExecutor() {
  registerExecutor('basedagents', {
    actions: ['claim', 'deliver'],
    ready: () => Boolean(process.env.BASEDAGENTS_PUBLIC_KEY_B58 && (process.env.BASEDAGENTS_PRIVATE_KEY_PEM || process.env.BASEDAGENTS_PRIVATE_KEY_HEX)),
    async execute(item, { action = 'claim', summary, content, pr_url, submission_type = 'text' } = {}) {
      const id = String(item.raw?.id || item.opportunity_id || item.id || '').replace(/^basedagents-/, '');
      if (!id) return { status: 'blocked', reason: 'task_id_missing' };

      if (action === 'claim') {
        return { status: 'claimed', source: 'basedagents', task_id: id, claim: await request(`/v1/tasks/${encodeURIComponent(id)}/claim`, 'POST', '') };
      }
      if (action === 'deliver') {
        if (!summary) return { status: 'blocked', reason: 'summary_required' };
        const payload = JSON.stringify({
          summary,
          submission_type,
          submission_content: content || '',
          ...(pr_url ? { pr_url } : {})
        });
        return { status: 'delivered', source: 'basedagents', task_id: id, delivery: await request(`/v1/tasks/${encodeURIComponent(id)}/deliver`, 'POST', payload) };
      }
      return { status: 'blocked', reason: 'unsupported_action' };
    }
  });
}
