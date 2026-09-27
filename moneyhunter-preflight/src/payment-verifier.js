import { fetchIssueContext } from './github.js';
import { detectPaymentSignals } from './signals.js';

const CACHE_TTL_MS = 10 * 60 * 1000;
const MAX_ENRICH_PER_RUN = 3;
const VERIFICATION_TIMEOUT_MS = 8000;
const cache = new Map();
let enrichmentsThisRun = 0;

function now() { return Date.now(); }
function combinedText(context) {
  const comments = (context.comments || []).map(c => c?.body || '').join('\n');
  const prs = (context.linkedPrs || []).map(p => `${p.title || ''}\n${p.url || ''}`).join('\n');
  return `${context.issue?.title || ''}\n${context.issue?.body || ''}\n${comments}\n${prs}`;
}
export function resetPaymentVerificationBudget() { enrichmentsThisRun = 0; }
export async function verifyGitHubPayment(issueUrl, initialPayment) {
  const cached = cache.get(issueUrl);
  if (cached && now() - cached.at < CACHE_TTL_MS) return cached.value;
  if (enrichmentsThisRun >= MAX_ENRICH_PER_RUN) return { score: initialPayment.score, enriched: false, reason: 'run_budget_exhausted', evidence: [] };
  enrichmentsThisRun += 1;
  try {
    const context = await Promise.race([
      fetchIssueContext(issueUrl),
      new Promise((_, reject) => setTimeout(() => reject(new Error('payment_verification_timeout')), VERIFICATION_TIMEOUT_MS))
    ]);
    const enriched = detectPaymentSignals('', combinedText(context));
    const value = { score: Math.max(initialPayment.score, enriched.score), enriched: true, evidence: [...new Set([...enriched.positive, ...enriched.warnings])], comments_checked: context.comments?.length || 0, linked_prs_checked: context.linkedPrs?.length || 0 };
    cache.set(issueUrl, { at: now(), value });
    return value;
  } catch (error) {
    return { score: initialPayment.score, enriched: false, reason: 'verification_error', error: error?.message?.slice(0, 180), evidence: [] };
  }
}