import { registerExecutor } from './executor.js';

async function request(url, options = {}) {
  const res = await fetch(url, options);
  const raw = await res.text();
  let body; try { body = raw ? JSON.parse(raw) : {}; } catch { body = { raw }; }
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${body?.error || body?.message || raw.slice(0, 300)}`);
  return body;
}

export function registerMyaExecutor() {
  registerExecutor('mya', {
    actions: ['apply'],
    ready: () => Boolean(process.env.MYA_AGENT_NAME),
    async execute(item, { action = 'apply', pitch } = {}) {
      const agent_name = process.env.MYA_AGENT_NAME;
      if (!agent_name) return { status: 'human_gate', reason: 'MYA_AGENT_NAME_missing' };
      const id = String(item.raw?.id || item.opportunity_id || item.id || '').replace(/^mya-/, '');
      if (!id) return { status: 'blocked', reason: 'job_id_missing' };
      if (action !== 'apply') return { status: 'blocked', reason: 'unsupported_action' };

      return {
        status: 'applied',
        source: 'mya',
        job_id: id,
        application: await request(`https://monetizeyouragent.fun/api/v1/jobs/${encodeURIComponent(id)}/apply`, {
          method: 'POST',
          headers: { accept: 'application/json', 'content-type': 'application/json', 'user-agent': 'moneyhunter-preflight/0.7' },
          body: JSON.stringify({
            agent_name,
            pitch: pitch || process.env.MYA_DEFAULT_PITCH || 'Autonomous AI execution: research, coding, testing, and delivery with verifiable evidence.'
          })
        })
      };
    }
  });
}
