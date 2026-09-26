export function estimateExpectedValue({
  rewardAmount,
  acceptanceProbability,
  estimatedMinutes,
  requiredSpend = 0,
  hourlyComputeCost = 0
}) {
  const reward = Math.max(0, Number(rewardAmount) || 0);
  const p = Math.max(0, Math.min(1, Number(acceptanceProbability) || 0));
  const minutes = Math.max(1, Number(estimatedMinutes) || 1);
  const spend = Math.max(0, Number(requiredSpend) || 0);
  const computeCost = (minutes / 60) * Math.max(0, Number(hourlyComputeCost) || 0);
  const expectedProfit = reward * p - spend - computeCost;
  return {
    expected_profit_usd: Number(expectedProfit.toFixed(2)),
    expected_hourly_usd: Number(((expectedProfit * 60) / minutes).toFixed(2)),
    required_spend_usd: spend,
    estimated_minutes: minutes,
    acceptance_probability: p
  };
}

export function estimateAcceptanceProbability(scores) {
  const weighted =
    (scores.payment || 0) * 0.28 +
    (scores.competition || 0) * 0.24 +
    (scores.clarity || 0) * 0.20 +
    (scores.ai_fit || 0) * 0.16 +
    (scores.freshness || 0) * 0.12;
  return Number(Math.max(0.05, Math.min(0.95, weighted / 100)).toFixed(2));
}
