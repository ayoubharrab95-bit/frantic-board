const CHANNELS = [
  { id:'bounties', capital:0, repeatability:0.75, automation:0.75, risk:0.15 },
  { id:'ai-services', capital:0, repeatability:0.65, automation:0.70, risk:0.10 },
  { id:'digital-products', capital:0, repeatability:0.90, automation:0.85, risk:0.10 },
  { id:'market-arbitrage', capital:1, repeatability:0.65, automation:0.90, risk:0.55 },
  { id:'ecommerce', capital:1, repeatability:0.70, automation:0.60, risk:0.45 },
  { id:'api-microservices', capital:0, repeatability:0.95, automation:0.90, risk:0.20 }
];

export function buildExpansionPlan({ capitalUsd=5, sourceStatus={}, outcomes=[] }={}) {
  const capital = Math.max(0, Number(capitalUsd)||0);
  const history = outcomes.filter(Boolean);
  const success = history.filter(x=>x.success).length;
  const failure = history.filter(x=>x.success === false).length;
  const successRate = history.length ? success / history.length : null;

  const channels = CHANNELS.map(c => {
    const source = sourceStatus[c.id];
    const evidence = source?.ok ? 0.15 : 0;
    const learned = successRate == null ? 0 : successRate * 0.25;
    const score = ((1-c.risk)*0.35 + c.repeatability*0.25 + c.automation*0.20 + (c.capital===0 ? 0.15 : Math.min(0.15, capital/1000*0.15)) + evidence + learned);
    return { ...c, priority_score:Number(score.toFixed(3)), mode:c.capital===0?'bootstrap':'capital_gated' };
  }).sort((a,b)=>b.priority_score-a.priority_score);

  const nextExperiments = [
    'Add at least one new independent opportunity source each improvement cycle.',
    'Turn repeated successful manual work into a reusable tool or product.',
    'Promote only opportunities with verified payout mechanics and explicit AI eligibility.',
    'Use market-arbitrage data for observation/paper trading before any real capital is considered.',
    'Track realized net profit and time-to-cash separately from headline revenue.'
  ];

  return {
    generated_at:new Date().toISOString(),
    objective:'increase the number, reliability, and automation of legitimate revenue channels over time',
    current_capital_usd:capital,
    learning:{observations:history.length,successes:success,failures:failure,observed_success_rate:successRate},
    channels,
    next_experiments:nextExperiments,
    stop_conditions:[
      'negative expected net value after fees',
      'unclear payout or ownership terms',
      'platform policy conflict',
      'identity/2FA/legal consent required',
      'irreversible financial transaction without explicit approval'
    ]
  };
}
