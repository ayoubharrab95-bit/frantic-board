import { registerExecutor } from './executor.js';

const DEFAULT_GOAL = [
  'Work only on the specified opportunity.',
  'Use the authenticated account/profile available to this run.',
  'Do not purchase anything, spend money, sign a wallet transaction, withdraw funds, transfer funds, accept a legal agreement, or complete KYC.',
  'If the site requires any of those actions, stop and report HUMAN_GATE_REQUIRED.',
  'If the opportunity has a claim or submission action that is allowed without payment/signature, perform it.',
  'Return structured JSON with status, action_taken, claim_id if available, submission_url if available, payout_status if visible, and human_gate if blocked.'
].join(' ');

function enabled() {
  return Boolean(process.env.TINYFISH_API_KEY);
}

function targetUrl(item = {}) {
  return item.raw?.url || item.url || item.external_link || item.raw?.issue_url || item.raw?.source_url || '';
}

function buildGoal(item = {}, context = {}) {
  const custom = item.raw?.tinyfish_goal || item.tinyfish_goal;
  if (custom) return custom;
  const title = String(item.title || item.name || 'paid opportunity').slice(0, 500);
  const url = targetUrl(item);
  return [
    DEFAULT_GOAL,
    `Opportunity title: ${title}.`,
    url ? `Open this target: ${url}.` : '',
    context.action ? `Preferred action: ${context.action}.` : '',
    'Do not invent a successful claim or submission. If the site does not confirm the action, report not_confirmed.'
  ].filter(Boolean).join(' ');
}

async function runAgent(item, context = {}) {
  if (!enabled()) return { status: 'human_gate', reason: 'TINYFISH_API_KEY_missing' };
  const url = targetUrl(item);
  if (!url) return { status: 'prepare', reason: 'tinyfish_target_url_missing' };

  const payload = {
    url,
    goal: buildGoal(item, context),
    browser_profile: process.env.TINYFISH_BROWSER_PROFILE || 'lite'
  };

  if (process.env.TINYFISH_USE_VAULT === 'true') payload.use_vault = true;
  if (process.env.TINYFISH_USE_PROFILE === 'true') payload.use_profile = true;
  if (process.env.TINYFISH_PROFILE_ID) payload.profile_id = process.env.TINYFISH_PROFILE_ID;

  const response = await fetch('https://agent.tinyfish.ai/v1/automation/run', {
    method: 'POST',
    headers: {
      'X-API-Key': process.env.TINYFISH_API_KEY,
      'Content-Type': 'application/json',
      'User-Agent': 'moneyhunter-preflight/1.0'
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(Number(process.env.TINYFISH_TIMEOUT_MS || 120000))
  });

  const raw = await response.text();
  let data;
  try { data = raw ? JSON.parse(raw) : {}; } catch { data = { raw }; }

  if (!response.ok) {
    if (response.status === 401 || response.status === 402 || response.status === 403) {
      return { status: 'human_gate', reason: `tinyfish_http_${response.status}`, detail: data?.error || raw.slice(0, 500) };
    }
    throw new Error(`TinyFish HTTP ${response.status}: ${data?.error || raw.slice(0, 500)}`);
  }

  if (data.status !== 'COMPLETED') {
    return { status: data.status === 'FAILED' ? 'error' : 'attempted', tinyfish: data };
  }

  const result = data.result ?? null;
  if (result?.human_gate || result?.status === 'HUMAN_GATE_REQUIRED') {
    return { status: 'human_gate', reason: result.human_gate || 'human_gate_required', tinyfish: data };
  }

  return { status: 'completed', tinyfish_run_id: data.run_id, result };
}

export function registerTinyFishExecutor() {
  registerExecutor('tinyfish', {
    actions: ['web_execute', 'claim', 'submit', 'verify_payout'],
    ready: enabled,
    async execute(item, context = {}) {
      if (context.action === 'verify_payout') {
        return runAgent(item, {
          ...context,
          action: 'verify payout status only; do not withdraw or transfer funds'
        });
      }
      return runAgent(item, context);
    }
  });
}

export { buildGoal, runAgent };
