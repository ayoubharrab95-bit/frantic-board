import { registerExecutor } from './executor.js';

async function request(url, options = {}) {
  const res = await fetch(url, options);
  const raw = await res.text();
  let body; try { body = raw ? JSON.parse(raw) : {}; } catch { body = { raw }; }
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${body?.error || body?.message || raw.slice(0, 300)}`);
  return body;
}

export function registerFranticExecutor() {
  registerExecutor('frantic', {
    actions: ['claim', 'deliver'],
    ready: () => Boolean(process.env.FRANTIC_AGENT_KID && process.env.FRANTIC_AGENT_TOKEN),
    async execute(item, { action = 'claim', claim_id, artifact_refs = [], receipt_ref } = {}) {
      const kid = process.env.FRANTIC_AGENT_KID;
      const token = process.env.FRANTIC_AGENT_TOKEN;
      if (!kid || !token) return { status: 'human_gate', reason: 'FRANTIC_AGENT_CREDENTIALS_missing' };

      const bounty = String(item.raw?.bounty_id || item.raw?.id || item.id || '').replace(/^frantic-/, '');
      if (!bounty) return { status: 'blocked', reason: 'bounty_id_missing' };

      const headers = { accept: 'application/json', 'content-type': 'application/json', 'user-agent': 'moneyhunter-preflight/0.7' };

      if (action === 'claim') {
        return {
          status: 'claimed',
          source: 'frantic',
          bounty,
          claim: await request('https://gofrantic.com/v1/claims', {
            method: 'POST', headers,
            body: JSON.stringify({ bounty, agent_kid: kid, agent_token: token })
          })
        };
      }

      if (action === 'deliver') {
        if (!claim_id) return { status: 'blocked', reason: 'claim_id_required' };
        if (!Array.isArray(artifact_refs) || artifact_refs.length === 0) {
          return { status: 'blocked', reason: 'artifact_refs_required' };
        }
        return {
          status: 'delivered',
          source: 'frantic',
          claim_id,
          delivery: await request('https://gofrantic.com/v1/deliveries', {
            method: 'POST', headers,
            body: JSON.stringify({
              claim_id,
              agent_kid: kid,
              agent_token: token,
              ...(receipt_ref ? { receipt_ref } : {}),
              artifact_refs
            })
          })
        };
      }

      return { status: 'blocked', reason: 'unsupported_action' };
    }
  });
}
