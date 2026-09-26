function daysSince(dateString, now = Date.now()) {
  if (!dateString) return Infinity;
  const t = new Date(dateString).getTime();
  if (!Number.isFinite(t)) return Infinity;
  return Math.max(0, (now - t) / 86_400_000);
}

function rewardScore(reward) {
  const value = reward?.amount;
  if (value == null) return 25;
  if (value < 1) return 5;
  if (value < 5) return 20;
  if (value < 20) return 55;
  if (value < 100) return 75;
  if (value < 500) return 90;
  return 80;
}

export function scoreCompetition({ comments = 0, assignees = 0, linkedOpenPrs = 0, claimSignals = 0 }) {
  let score = 100;
  score -= Math.min(45, comments * 2);
  score -= Math.min(30, claimSignals * 8);
  score -= Math.min(50, linkedOpenPrs * 20);
  if (assignees > 0) score -= 40;
  return Math.max(0, score);
}

export function scoreFreshness(repository, now = Date.now()) {
  if (repository?.archived || repository?.disabled) return 0;
  const days = daysSince(repository?.pushed_at, now);
  if (days <= 7) return 100;
  if (days <= 30) return 85;
  if (days <= 90) return 65;
  if (days <= 365) return 40;
  return 15;
}

export function combineScores({ payment, competition, clarity, ai, freshness, reward }) {
  return Math.round(
    payment * 0.30 +
    competition * 0.20 +
    clarity * 0.15 +
    ai * 0.15 +
    freshness * 0.10 +
    rewardScore(reward) * 0.10
  );
}

export function chooseRecommendation({ issueState, archived, aiStatus, paymentWarnings, total, reward }) {
  if (issueState !== 'open') return 'SKIP';
  if (archived) return 'SKIP';
  if (aiStatus === 'prohibited') return 'SKIP';
  if ((paymentWarnings || []).some((w) => /honeypot|unfunded|not yet active|unbacked/i.test(w))) return 'SKIP';
  if (reward?.amount == null) return total >= 70 ? 'REVIEW' : 'SKIP';
  if (total >= 72) return 'GO';
  if (total >= 52) return 'REVIEW';
  return 'SKIP';
}
