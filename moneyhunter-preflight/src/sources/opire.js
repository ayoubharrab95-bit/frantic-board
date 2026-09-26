import { makeOpportunity } from '../opportunity.js';
import { boundedFetch } from './network.js';

const HOME = 'https://app.opire.dev/home';

function decode(text = '') {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, ' ');
}

export function stripHtml(html = '') {
  return decode(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
  ).trim();
}

export function parseOpireHome(html = '') {
  const text = stripHtml(html);
  const out = [];

  // Opire's rendered page presents cards in the rough form:
  // owner repo date title ... $amount ... N solvers
  const re = /([A-Za-z0-9_.-]+)\s+([A-Za-z0-9_.-]+)\s+(\d{2}\/\d{2}\/\d{4})\s+(.{3,220}?)\s+\$\s*([0-9][0-9,]*(?:\.\d{1,2})?)\s+(?:(\d+)\s+solvers?|0\s+solvers?)/g;
  let m;
  let index = 0;

  while ((m = re.exec(text)) && index < 100) {
    const [, owner, repo, date, titleRaw, amountRaw, solversRaw] = m;
    const reward = Number(amountRaw.replace(/,/g, ''));
    if (!Number.isFinite(reward) || reward <= 0) continue;

    const title = titleRaw
      .replace(/\b(?:Java|Python|TypeScript|Rust|Go|C\+\+|Command available)\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const solvers = Number(solversRaw || 0);
    const suspiciousScale = reward > 10000 ? 0.12 : reward > 2500 ? 0.45 : 1;

    out.push(makeOpportunity({
      id: `opire-${owner}-${repo}-${index++}`,
      source: 'opire',
      url: HOME,
      title: `${owner}/${repo}: ${title}`,
      reward,
      currency: 'USD',
      // The home-page text does not carry a canonical issue link or live issue
      // state. Directory entries routinely outlive closed GitHub issues.
      status: 'unverified',
      active_claims: solvers,
      ai_policy: 'unknown',
      payment_confidence: 0.25 * suspiciousScale,
      competition_score: Math.max(0.05, 1 / (1 + solvers)),
      requires_manual_payment: true,
      raw: {
        owner,
        repo,
        date,
        solvers,
        warning: 'Original GitHub issue and reward must be checked on the detail page before this can be advertised as open.'
      }
    }));
  }

  return out;
}

export async function discoverOpire({ limit = 25, fetchImpl = fetch } = {}) {
  const res = await boundedFetch(fetchImpl, HOME, {
    headers: { 'user-agent': 'moneyhunter-preflight/0.3' }
  });
  if (!res.ok) throw new Error(`Opire HTTP ${res.status}`);
  return parseOpireHome(await res.text()).slice(0, limit);
}
