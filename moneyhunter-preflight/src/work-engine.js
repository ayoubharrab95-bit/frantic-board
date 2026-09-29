const CAPABILITIES = Object.freeze([
  {id:'software_delivery', labels:['bugfix','code','github','pull request','pr','test','ci','api integration'], deliverables:['patch','tests','pull_request','verification']},
  {id:'research_data', labels:['research','data','scrape','scraping','web data','extract','normalize','json','csv'], deliverables:['structured_data','sources','summary','validation']},
  {id:'testing_qa', labels:['test','qa','regression','reproduce','verification','audit'], deliverables:['test_report','reproduction','verification']},
  {id:'documentation', labels:['docs','documentation','readme','guide','tutorial'], deliverables:['markdown','examples','verification']},
  {id:'automation_api', labels:['automation','api','webhook','integration','workflow'], deliverables:['script','api_contract','tests','runbook']},
  {id:'micro_service', labels:['micro','transform','json normalize','text stats','preflight','utility'], deliverables:['machine_readable_result','schema','validation']}
]);

function textOf(item={}) { return [item.title,item.description,item.category,item.tags?.join?.(' '),item.raw?.instructions,item.raw?.description].filter(Boolean).join(' ').toLowerCase(); }
function capabilityFor(item={}) {
  const text=textOf(item);
  let best={capability:'general_digital_work',score:0};
  for(const cap of CAPABILITIES){
    const score=cap.labels.reduce((n,label)=>n+(text.includes(label)?1:0),0);
    if(score>best.score) best={capability:cap.id,score};
  }
  return best.capability;
}
function modeFor(item={}) {
  if(item.requires_spending===true || item.requires_wallet_signature===true || item.requires_2fa===true || item.requires_login===true || item.requires_kyc===true || item.requires_legal_consent===true) return 'human_gate';
  if(item.claim_api_available || item.submit_api_available) return 'api';
  if(item.web_automation_available) return 'web_review_only';
  return 'prepare';
}
function workItem(item={}) {
  const capability=capabilityFor(item);
  const cap=CAPABILITIES.find(x=>x.id===capability);
  const mode=modeFor(item);
  return {
    opportunity_id:item.id||item.opportunity_id||null,
    source:item.source||'unknown',
    title:item.title||'Untitled paid work',
    reward_usd:Number(item.reward||0),
    capability,
    execution_mode:mode,
    deliverables:cap?.deliverables||['validated_digital_deliverable'],
    acceptance_checks:['requirements_explicit','ai_policy_verified','output_reproducible','evidence_attached','payment_state_verified'],
    safety_gates:['no_private_keys_or_seed_phrases','no_unsanctioned_spending','no_wallet_signing','no_kyc_or_legal_consent','no_bypass_of_platform_or_ai_rules'],
    next_action: mode==='human_gate' ? 'prepare_handoff_for_user' : mode==='api' ? 'execute_with_credentialed_executor' : 'prepare_and_validate'
  };
}
export function listCapabilities(){return CAPABILITIES.map(x=>({...x,labels:[...x.labels],deliverables:[...x.deliverables]}));}
export function buildWorkPlan({opportunities=[]}={}) {
  const items=opportunities.map(workItem);
  const counts={}; for(const x of items) counts[x.capability]=(counts[x.capability]||0)+1;
  return {generated_at:new Date().toISOString(),objective:'maximize legitimate revenue by matching each opportunity to the strongest available execution capability',capabilities:listCapabilities(),count:items.length,capability_counts:counts,work:items};
}
