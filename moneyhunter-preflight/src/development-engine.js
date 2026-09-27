import { readLedger, summarizeLedger, getSourcePriors } from './revenue-memory.js';

const TASKS = [
  {id:'repair-source', priority:1, trigger:s=>s.failedSources.length>0, action:'fallback_source'},
  {id:'expand-source', priority:2, trigger:s=>s.emptySources.length>=2, action:'expand_discovery'},
  {id:'improve-payout-confidence', priority:3, trigger:s=>s.lowPaymentCount>0, action:'improve_payment_verification'},
  {id:'improve-executor-coverage', priority:4, trigger:s=>s.uncredentialedExecutors>0, action:'prepare_credential_path'},
  {id:'improve-learning', priority:5, trigger:s=>s.ledgerEntries>0 && s.paidEntries===0, action:'improve_outcome_tracking'},
  {id:'improve-portfolio', priority:6, trigger:s=>s.ledgerEntries===0, action:'expand_bootstrap_channels'},
  {id:'verify-system', priority:7, trigger:()=>true, action:'run_regression_and_health_check'}
];

let lastCycle=null;
let cycleRunning=false;

function summarize({sourceStatus={},executors=[],ledger=[]}={}){
  const entries=ledger.filter(x=>x.record_type!=='execution');
  const failedSources=Object.entries(sourceStatus).filter(([,v])=>!v?.ok).map(([source])=>source);
  const emptySources=Object.entries(sourceStatus).filter(([,v])=>v?.ok && Number(v.found||0)===0).map(([source])=>source);
  const paidEntries=entries.filter(x=>x.paid || Number(x.payout_usd||0)>0);
  return {
    ledgerEntries:entries.length,
    paidEntries:paidEntries.length,
    failedSources,
    emptySources,
    lowPaymentCount:ledger.filter(x=>x.record_type==='execution' && Number(x.payment_confidence||0)<0.8).length,
    uncredentialedExecutors:executors.filter(x=>x.available && !x.credentialed).length
  };
}

export async function buildDevelopmentPlan({sourceStatus={},executors=[]}={}){
  const ledger=await readLedger();
  const state=summarize({sourceStatus,executors,ledger});
  const priors=await getSourcePriors();
  const eligible=TASKS.filter(t=>t.trigger(state)).sort((a,b)=>a.priority-b.priority);
  const selected=eligible[0] || TASKS.at(-1);
  return {
    generated_at:new Date().toISOString(),
    mode:'safe_self_development',
    selected,
    state,
    source_priors:priors,
    pipeline:[
      'diagnose',
      'select_highest_impact_safe_change',
      'prepare_patch_or_configuration',
      'run_lint_and_tests',
      'deploy_only_after_validation',
      'verify_health',
      'record_result',
      'resume_revenue_hunt'
    ],
    human_gates:[
      'login','2fa','wallet_signature','spending','kyc','legal_consent','private_key','seed_phrase','irreversible_action'
    ],
    guardrails:[
      'never modify secrets or credentials',
      'never spend or sign funds',
      'never bypass platform or AI-use restrictions',
      'quarantine changes that fail validation',
      'prefer reversible changes and feature flags'
    ]
  };
}

export async function runDevelopmentCycle(context={}){
  if(cycleRunning) return {status:'busy',last_cycle:lastCycle};
  cycleRunning=true;
  try{
    const plan=await buildDevelopmentPlan(context);
    const safe=plan.selected.action;
    const result={
      status:'planned',
      action:safe,
      task_id:plan.selected.id,
      reason:plan.state,
      execution_boundary:'runtime can diagnose, prioritize and validate; source-code mutation remains a controlled deployment operation'
    };
    lastCycle={at:new Date().toISOString(),...result};
    console.log(JSON.stringify({event:'self_development_cycle',...lastCycle}));
    return {...plan,result};
  }finally{cycleRunning=false;}
}

export function developmentStatus(){return{running:cycleRunning,last_cycle:lastCycle};}
