import { fetchIssueContext } from './github.js';
import {
  extractReward,
  detectPaymentSignals,
  detectAiPolicy,
  detectClarity,
  detectClaimSignals
} from './signals.js';
import {
  scoreCompetition,
  scoreFreshness,
  combineScores,
  chooseRecommendation
} from './scoring.js';
import { estimateAcceptanceProbability, estimateExpectedValue } from './economics.js';
import { canonicalOpportunityKey } from './dedupe.js';

export function analyzeContext(context) {
  const { issue, repository, comments, linkedPrs, owner, repo, issueNumber } = context;
  const body = issue.body || '';
  const reward = extractReward(issue.title || '', body);
  const payment = detectPaymentSignals(issue.title || '', body);
  const aiPolicy = detectAiPolicy(issue.title || '', body);
  const clarity = detectClarity(body);
  const claimSignals = detectClaimSignals(comments);
  const linkedOpenPrs = linkedPrs.filter((p) => p.state === 'open');

  const competitionScore = scoreCompetition({
    comments: issue.comments || comments.length,
    assignees: issue.assignees?.length || 0,
    linkedOpenPrs: linkedOpenPrs.length,
    claimSignals: claimSignals.length
  });

  const freshnessScore = scoreFreshness(repository);
  const total = combineScores({
    payment: payment.score,
    competition: competitionScore,
    clarity: clarity.score,
    ai: aiPolicy.score,
    freshness: freshnessScore,
    reward
  });

  const redFlags = [...payment.warnings];
  if (repository.archived) redFlags.push('Repository is archived.');
  if (issue.state !== 'open') redFlags.push(`Issue is ${issue.state}.`);
  if ((issue.assignees?.length || 0) > 0) redFlags.push('Issue is already assigned.');
  if (linkedOpenPrs.length > 0) redFlags.push(`${linkedOpenPrs.length} linked open PR(s) detected.`);
  if (claimSignals.length >= 3) redFlags.push('Multiple claim/attempt signals found in comments.');
  if (aiPolicy.status === 'unknown') {
    redFlags.push('AI/automation policy is not explicit; verify before submitting.');
  }

  const acceptanceProbability = estimateAcceptanceProbability({
    payment: payment.score,
    competition: competitionScore,
    clarity: clarity.score,
    ai_fit: aiPolicy.score,
    freshness: freshnessScore
  });
  const economics = estimateExpectedValue({
    rewardAmount: reward.amount,
    acceptanceProbability,
    estimatedMinutes: 60,
    requiredSpend: 0
  });

  const recommendation = chooseRecommendation({
    issueState: issue.state,
    archived: repository.archived,
    aiStatus: aiPolicy.status,
    paymentWarnings: payment.warnings,
    total,
    reward
  });

  return {
    version: '0.1.0',
    analyzed_at: new Date().toISOString(),
    opportunity_key: canonicalOpportunityKey({
      platform: 'github', repository: `${owner}/${repo}`, issue_number: issueNumber, issue_url: issue.html_url
    }),
    source: {
      platform: 'github',
      repository: `${owner}/${repo}`,
      issue_number: issueNumber,
      issue_url: issue.html_url,
      title: issue.title,
      state: issue.state
    },
    reward,
    payment: {
      score: payment.score,
      positive_signals: payment.positive,
      warnings: payment.warnings
    },
    ai_policy: aiPolicy,
    competition: {
      score: competitionScore,
      issue_comments: issue.comments || comments.length,
      assignees: issue.assignees?.map((a) => a.login) || [],
      claim_signals: claimSignals,
      linked_open_prs: linkedOpenPrs
    },
    task_clarity: clarity,
    repository: {
      archived: repository.archived,
      disabled: repository.disabled,
      pushed_at: repository.pushed_at,
      stars: repository.stargazers_count,
      forks: repository.forks_count,
      default_branch: repository.default_branch,
      freshness_score: freshnessScore
    },
    scores: {
      payment: payment.score,
      competition: competitionScore,
      clarity: clarity.score,
      ai_fit: aiPolicy.score,
      freshness: freshnessScore,
      priority: total
    },
    recommendation,
    economics,
    red_flags: redFlags,
    next_action:
      recommendation === 'GO'
        ? 'Verify platform-specific claim rules, then claim/reserve before spending significant compute.'
        : recommendation === 'REVIEW'
          ? 'Manual verification is required before claiming or spending compute.'
          : 'Do not spend agent compute on this opportunity.'
  };
}

export async function analyzeIssueUrl(issueUrl) {
  const context = await fetchIssueContext(issueUrl);
  return analyzeContext(context);
}
