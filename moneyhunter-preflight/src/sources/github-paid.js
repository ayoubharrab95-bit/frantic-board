import { makeOpportunity } from '../opportunity.js';
import { extractReward, detectAiPolicy, detectPaymentSignals } from '../signals.js';
import { verifyGitHubPayment, resetPaymentVerificationBudget } from '../payment-verifier.js';
import { boundedFetch } from './network.js';

const API = 'https://api.github.com';

function headers() {
  const h = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'moneyhunter-preflight/0.3'
  };
  if (process.env.GITHUB_TOKEN) h.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  return h;
}

async function searchIssues(q, fetchImpl = fetch) {
  const url = `${API}/search/issues?q=${encodeURIComponent(q)}&sort=updated&order=desc&per_page=50`;
  const res = await boundedFetch(fetchImpl, url, { headers: headers() });
  if (!res.ok) throw new Error(`GitHub search HTTP ${res.status}`);
  const json = await res.json();
  return json.items || [];
}

function repositoryFromApiUrl(repositoryUrl = '') {
  const m = repositoryUrl.match(/\/repos\/([^/]+\/[^/]+)$/);
  return m?.[1] || null;
}

function requiresSpendingOrWalletAction(text = '') {
  return /\b(?:x402|quote_proof|pay_challenge|wallet.*sign|sign.*relay|transaction fee|gas fee)\b/i.test(text)
    || /\bpay\s+(?:the|a|returned)\s+(?:x402|challenge|fee|quote)\b/i.test(text)
    || /\b(?:entry\/claim|claim|entry)\s+bond\b/i.test(text)
    || /\b(?:bond|entry\s+fee)\b[^\n]{0,80}\b(?:USDC|USD|\$)/i.test(text)
    || /\b(?:USDC|USD|\$)[^\n]{0,80}\b(?:bond|entry\s+fee)\b/i.test(text);
}

function canonicalSolverReward(text = '') {
  const m = text.match(/\*\*Solver reward:\*\*\s*([0-9]+(?:\.[0-9]+)?)\s*USDC/i);
  return m ? Number(m[1]) : null;
}

function isLikelyPaid(issue) {
  const text = `${issue.title || ''}\n${issue.body || ''}`;
  return /\b(bounty|reward|paid issue|USDC|USD|\$\s*\d+)\b/i.test(text);
}

export function classifyPaymentState({ text = '', paymentScore = 0, requiresSpending = false } = {}) {
  const explicitManualPayment = /\b(?:manual(?:ly)?\s+(?:pay|payout|payment)|payment\s+(?:must|will)\s+be\s+manual|invoice\s+(?:required|needed)|bank\s+transfer\s+after\s+(?:acceptance|merge)|contact\s+(?:the\s+)?maintainer\s+(?:for|about)\s+payment)\b/i.test(text);
  const hasEscrow = /\b(?:escrow(?:ed)?|funded[- ]live|funding confirmed|escrow locked|fully funded)\b/i.test(text);
  const hasAutomaticTrigger = /\b(?:paid on merge|payment on merge|paid when merged|payout on merge|logged on merge|auto(?:matic)?(?:ally)?\s+(?:pay|payout|payment)|payout within\s+\d+\s+(?:hours?|days?))\b/i.test(text);
  const state = requiresSpending
    ? 'spending_required'
    : explicitManualPayment
      ? 'manual'
      : hasEscrow
        ? 'escrow'
        : hasAutomaticTrigger || paymentScore >= 80
          ? 'strong'
          : 'unknown';
  return { state, requiresManualPayment: explicitManualPayment || requiresSpending };
}

export async function discoverGitHubPaid({ limit = 25, fetchImpl = fetch } = {}) {
  resetPaymentVerificationBudget();
  const queries = [
    'is:issue is:open bounty "$"',
    'is:issue is:open reward USDC',
    'is:issue is:open "paid issue"',
    'is:issue is:open label:bounty'
  ];

  const merged = new Map();

  await Promise.all(queries.map(async (q) => {
    try {
      for (const issue of await searchIssues(q, fetchImpl)) {
        if (!issue?.html_url || !isLikelyPaid(issue)) continue;
        merged.set(issue.html_url, issue);
        if (merged.size >= limit * 3) break;
      }
    } catch {
      // A single query can rate-limit or fail without killing the whole radar.
    }
  }));

  const results = [];
  for (const issue of [...merged.values()].slice(0, limit * 2)) {
    const fullText = `${issue.title || ''}\n${issue.body || ''}`;
    const parsedReward = extractReward(issue.title || '', issue.body || '');
    const canonicalReward = canonicalSolverReward(fullText);
    const reward = canonicalReward != null
      ? { ...parsedReward, amount: canonicalReward, currency: 'USDC' }
      : parsedReward;
    if (reward.amount == null) continue;

    const payment = detectPaymentSignals(issue.title || '', issue.body || '');
    const verification = payment.score >= 55 && payment.score < 80
      ? await verifyGitHubPayment(issue.html_url, payment)
      : { score: payment.score, enriched: false, evidence: [] };
    const ai = detectAiPolicy(issue.title || '', issue.body || '');
    const paymentScore = Math.max(payment.score, verification.score);
    const repo = repositoryFromApiUrl(issue.repository_url);
    const requiresSpending = requiresSpendingOrWalletAction(fullText);
    const paymentClassification = classifyPaymentState({ text: fullText, paymentScore, requiresSpending });
    const paymentState = paymentClassification.state;
    const requiresManualPayment = paymentClassification.requiresManualPayment;

    results.push(makeOpportunity({
      id: `gh-${issue.id}`,
      source: 'github',
      url: issue.html_url,
      title: issue.title,
      reward: reward.amount,
      currency: reward.currency || 'USD',
      status: issue.state === 'open' ? 'open' : 'closed',
      active_claims: issue.comments || 0,
      ai_policy: ai.status,
      payment_confidence: Math.max(0.05, paymentScore / 100),
      payment_state: paymentState,
      competition_score: Math.max(0.05, 1 / (1 + (issue.comments || 0) / 4)),
      requires_manual_payment: requiresManualPayment,
      requires_spending: requiresSpending,
      raw: {
        repository: repo,
        created_at: issue.created_at,
        updated_at: issue.updated_at,
        payment_signals: payment,
        payment_verification: verification,
        payment_state: paymentState,
        ai_policy: ai
      }
    }));
  }

  return results.slice(0, limit);
}
