import { getSourcePriors, readLedger, summarizeLedger } from './revenue-memory.js';

const DEFAULTS = {
  minPaymentConfidence: Number(process.env.AUTO_EXECUTE_MIN_PAYMENT_CONFIDENCE || 0.80),
  minHourlyUsd: Number(process.env.MIN_EXPECTED_HOURLY_USD || 10),
  maxConcurrent: Number(process.env.MAX_CONCURRENT_OPPORTUNITIES || 3),
  explorationRate: Number(process.env.EXPLORATION_RATE || 0.20)
};

function clamp(n,a=0,b=1){ return Math.max(a,Math.min(b,n)); }

function opportunityScore(o, prior=0.7){
  const reward = Math.max(0,Number(o.reward||0));
  const ev = Math.max(0,Number(o.expected_value||o.economics?.expected_value||0));
  const hourly = Math.max(0,Number(o.expected_hourly_usd||o.economics?.expected_hourly_usd||0));
  const pay = clamp(Number(o.payment_confidence||o.payment?.confidence||0));
  const competition = clamp(Number(o.competition_score||o.competition||0));
  const effort = Math.max(0.1,Number(o.effort_hours||o.economics?.effort_hours||1));
  const risk = clamp(Number(o.risk_score||o.risk||0.25));
  const source = clamp(Number(prior)/1.25);
  const rewardValue = Math.min(1,reward/500);
  const hourlyValue = Math.min(1,hourly/50);
  return Number((100*(0.22*pay + 0.20*hourlyValue + 0.15*rewardValue + 0.15*source + 0.10*clamp(1-competition) + 0.08*clamp(1-risk) + 0.10*clamp(ev/(reward||1)))).toFixed(2));
}

export async function buildStrategyState(opportunities=[]){
  const ledger=await readLedger();
  const priors=await getSourcePriors();
  const sourceStats=summarizeLedger(ledger);
  const enriched=opportunities.map(o=>({...o,strategy_score:opportunityScore(o,priors[o.source]??0.7)}))
    .sort((a,b)=>b.strategy_score-a.strategy_score);
  const profitableSources=sourceStats.filter(x=>x.paid>0).map(x=>x.source);
  const weakSources=sourceStats.filter(x=>x.attempts>=3 && x.payment_rate<0.25).map(x=>x.source);
  return {
    generated_at:new Date().toISOString(),
    policy:{...DEFAULTS},
    mode: enriched.length ? 'exploit_and_explore' : 'discovery_and_repair',
    source_priors:priors,
    source_stats:sourceStats,
    profitable_sources:profitableSources,
    weak_sources:weakSources,
    ranked_opportunities:enriched.slice(0,25),
    next_actions:[
      enriched.length?'execute only candidates passing payout, policy and credential gates':'expand discovery across all configured sources',
      weakSources.length?'deprioritize weak sources until payment outcomes improve':'keep source allocation balanced',
      profitableSources.length?'increase attention to sources with verified payouts':'collect verified outcome data before increasing exposure',
      'never spend capital or sign a wallet transaction without explicit approval'
    ]
  };
}
