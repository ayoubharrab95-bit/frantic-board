const clamp=(n,min=0,max=1)=>Math.max(min,Math.min(max,Number(n)||0));

export const ZERO_CAPITAL_RULES=Object.freeze({
  max_upfront_spend_usd:0,
  paid_ads_allowed:false,
  inventory_purchase_allowed:false,
  required_payment_confidence:0.80,
  required_repeatability:0.65
});

export function isZeroCapital(item={}){
  return item.requires_spending!==true
    && item.requires_manual_payment!==true
    && item.requires_wallet_signature!==true
    && item.requires_kyc!==true
    && item.requires_legal_consent!==true
    && item.ai_policy!=='prohibited';
}

export function scoreZeroCapital(item={}){
  const payment=clamp(item.payment_confidence??0);
  const repeatability=clamp(item.repeatability??0.65);
  const automation=clamp(item.automation_score??(item.claim_api_available||item.submit_api_available?0.9:0.65));
  const demand=clamp(item.demand_score??0.55);
  const competition=clamp(item.competition_score??0.5);
  const reward=Math.max(0,Number(item.reward)||0);
  const score=payment*.30+repeatability*.25+automation*.20+demand*.15+(1-competition)*.10;
  return {...item,zero_capital:true,zero_capital_score:Number(score.toFixed(4)),expected_zero_capital_value_usd:Number((reward*payment*repeatability*automation).toFixed(2))};
}

export function buildZeroCapitalPlan(opportunities=[]){
  const candidates=opportunities
    .filter(isZeroCapital)
    .filter(i=>Number(i.payment_confidence??0)>=ZERO_CAPITAL_RULES.required_payment_confidence)
    .map(scoreZeroCapital)
    .filter(i=>i.expected_zero_capital_value_usd>0||Number(i.reward||0)>0)
    .sort((a,b)=>b.zero_capital_score-a.zero_capital_score);
  return {
    version:'1.0',
    generated_at:new Date().toISOString(),
    policy:ZERO_CAPITAL_RULES,
    count:candidates.length,
    opportunities:candidates,
    actions:candidates.slice(0,10).map(i=>({
      id:i.id,
      action:i.claim_api_available||i.submit_api_available?'execute_if_authorized':'prepare_free_execution',
      source:i.source,
      reward:Number(i.reward||0)
    }))
  };
}

export function buildCommerceOffers({opportunities=[],completedOutcomes=[]}={}){
  const offers=[];
  for(const item of opportunities.filter(isZeroCapital)){
    offers.push({
      id:`zc-${item.id||item.source||'opportunity'}`,
      type:'service_or_digital',
      source:item.source,
      title:`Solve: ${String(item.title||'verified paid task').slice(0,100)}`,
      fulfillment:'AI-assisted digital delivery',
      acquisition:'organic_only',
      upfront_cost_usd:0,
      paid_ads:false,
      inventory:false,
      status:'candidate',
      evidence_url:item.url||item.external_link||item.raw?.url||null
    });
  }
  for(const outcome of completedOutcomes){
    if(outcome?.accepted!==true)continue;
    offers.push({
      id:`asset-${outcome.id||Date.now()}`,
      type:'reusable_digital_asset',
      title:`Reusable asset derived from ${outcome.title||'completed work'}`,
      fulfillment:'automated digital delivery',
      acquisition:'organic_only',
      upfront_cost_usd:0,
      paid_ads:false,
      inventory:false,
      status:'ready_for_human_marketplace_setup'
    });
  }
  return {generated_at:new Date().toISOString(),count:offers.length,offers};
}
