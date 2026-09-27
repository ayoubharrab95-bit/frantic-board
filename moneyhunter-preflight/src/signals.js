const moneyNumber = '([0-9]+(?:[,.][0-9]+)*)';

function amount(raw) {
  const value = Number(String(raw).replace(/,/g, ''));
  return Number.isFinite(value) ? value : null;
}

export function extractReward(title = '', body = '') {
  const text = `${title}\n${body}`;
  const targeted = [
    new RegExp(`(?:reward|bounty|prize|payout)\\s*(?:amount)?\\s*[:=\\-–—]?\\s*\\$\\s*${moneyNumber}\\s*(USDC|USD)?`, 'i'),
    new RegExp(`(?:reward|bounty|prize|payout)\\s*(?:amount)?\\s*[:=\\-–—]?\\s*${moneyNumber}\\s*(USDC|USD)`, 'i'),
    new RegExp(`\\$\\s*${moneyNumber}\\s*(USDC|USD)\\s*(?:reward|bounty|prize|payout)?`, 'i')
  ];

  for (const pattern of targeted) {
    const m = text.match(pattern);
    if (!m) continue;
    const value = amount(m[1]);
    if (value !== null) {
      return {
        amount: value,
        currency: (m[2] || 'USD').toUpperCase(),
        evidence: m[0]
      };
    }
  }

  if (/\b(bounty|paid bounty|reward|prize)\b/i.test(title)) {
    const m = title.match(new RegExp(`\\$\\s*${moneyNumber}`, 'i'));
    if (m) return { amount: amount(m[1]), currency: 'USD', evidence: m[0] };
  }

  return { amount: null, currency: null, evidence: null };
}

export function detectPaymentSignals(title = '', body = '') {
  const text = `${title}\n${body}`;
  let score = 25;
  const positive = [];
  const warnings = [];

  const plus = (points, label) => {
    score += points;
    positive.push(label);
  };
  const minus = (points, label) => {
    score -= points;
    warnings.push(label);
  };

  if (/\b(escrow(?:ed)?|funded[- ]live|funding confirmed|escrow locked|fully funded)\b/i.test(text)) {
    plus(35, 'Funding or escrow is explicitly stated.');
  }
  if (/\bUSDC\b/i.test(text)) {
    plus(10, 'Stablecoin payout (USDC) is mentioned.');
  }
  if (/\b(payment|payout|paid)\b.{0,50}\b(merge|accept|approval|settle|settlement)\b/is.test(text)) {
    plus(10, 'A payout trigger is described.');
  }
  if (/\b(receipt|transaction hash|on-chain|settlement evidence)\b/i.test(text)) {
    plus(10, 'Payment evidence language is present.');
  }

  if (/\b(proposed reward|bounty proposal|proposed bounty|not an existing award|unfunded|waiting sponsor|funding is being prepared)\b/i.test(text)) {
    minus(55, 'Reward appears proposed, unfunded, or not yet active.');
  }
  if (/\b(pinky-promise|honeypot|bait issue|no .* escrow)\b/i.test(text)) {
    minus(80, 'Honeypot/unbacked-payment language detected.');
  }
  if (/\b(token|coin) reward\b/i.test(text) && !/\bUSDC\b/i.test(text)) {
    minus(15, 'Reward may be a volatile project token rather than USD/stablecoin.');
  }

  return {
    score: Math.max(0, Math.min(100, score)),
    positive,
    warnings
  };
}

export function detectAiPolicy(title = '', body = '') {
  const text = `${title}\n${body}`;

  const deny = [
    /\bno ai(?:[- ]generated)?\b/i,
    /\bai[- ]generated .* (?:not allowed|declined|rejected|prohibited)\b/i,
    /\bhuman[- ]only\b/i,
    /\bdo not use (?:ai|llm|agents?)\b/i
  ];
  for (const pattern of deny) {
    const m = text.match(pattern);
    if (m) return { status: 'prohibited', score: 0, evidence: m[0] };
  }

  const allow = [
    /\bai[- ]agent[- ]friendly\b/i,
    /\bai (?:coding )?(?:agents?|assistants?) .* (?:welcome|allowed|may)\b/i,
    /\bfor ai agents\b/i,
    /\bautonomous (?:ai )?agents?\b/i,
    /\bagent-task\b/i
  ];
  for (const pattern of allow) {
    const m = text.match(pattern);
    if (m) return { status: 'allowed', score: 100, evidence: m[0] };
  }

  return { status: 'unknown', score: 55, evidence: null };
}

export function detectClarity(body = '') {
  let score = 25;
  const signals = [];

  if (/acceptance criteria/i.test(body)) {
    score += 30;
    signals.push('Acceptance criteria are present.');
  }
  if (/how to verify|verification|test(?:ing)?/i.test(body)) {
    score += 20;
    signals.push('Verification/testing instructions are present.');
  }
  if (/likely files|files? to (?:create|modify|touch)|expected output|deliverable/i.test(body)) {
    score += 15;
    signals.push('Expected files or deliverables are scoped.');
  }
  if (/how to claim|submission|pull request|\bPR\b/i.test(body)) {
    score += 10;
    signals.push('Submission/claim path is described.');
  }

  return { score: Math.min(100, score), signals };
}

export function detectClaimSignals(comments = []) {
  const matches = [];
  const pattern = /\b(claiming|i(?:'| a)?m (?:working|taking)|\/claim|\/attempt|pr submitted|pull request|opened.*pr)\b/i;

  for (const comment of comments) {
    const body = comment?.body || '';
    const m = body.match(pattern);
    if (m) {
      matches.push({
        user: comment?.user?.login || 'unknown',
        signal: m[0]
      });
    }
  }

  return matches;
}
