const SAFE_AUTOMATION = new Set([
  'discover','research','score','verify_payment','rank','prepare',
  'generate_asset','test','lint','build','deploy','submit_pr',
  'request_review','record_result','learn','reallocate_attention',
  'deprioritize','retry','fallback_source'
]);
const HUMAN_GATES = new Set([
  'login','2fa','wallet_signature','spending','kyc','legal_consent',
  'irreversible_action','private_key','seed_phrase'
]);

export function autonomyDecision(action, context={}) {
  const a=String(action||'').toLowerCase();
  if(HUMAN_GATES.has(a)) return {
    mode:'human_gate', action:a, autonomous:false,
    reason:'requires_owner_authorization'
  };
  if(SAFE_AUTOMATION.has(a)) return {
    mode:'autonomous', action:a, autonomous:true,
    reason:'safe_reversible_or_observational'
  };
  return {
    mode:'review', action:a, autonomous:false,
    reason:'unknown_action'
  };
}

export function buildAutonomyPolicy(){
  return {
    mission:'maximize_verified_revenue while preserving capital and owner control',
    autonomous: [...SAFE_AUTOMATION],
    human_gates:[...HUMAN_GATES],
    rules:[
      'Never request or store private keys or seed phrases',
      'Never bypass login, 2FA, KYC, legal consent, or platform restrictions',
      'Never spend funds or sign a wallet transaction autonomously',
      'Prefer verified payouts over advertised rewards',
      'Use multiple independent revenue channels',
      'Increase exposure only after verified positive outcomes',
      'Automatically repair, retry, fallback, test, and redeploy safe software failures',
      'Record every material execution and payout outcome'
    ]
  };
}

export function buildSelfHealingPlan({errors=[],sources=[],executors=[]}={}){
  const actions=[];
  for(const e of errors.slice(0,20)){
    const msg=String(e.message||e.error||e);
    if(/timeout|5\\d\\d|rate.?limit|network/i.test(msg))
      actions.push({type:'retry_with_backoff',target:e.target||'unknown'});
    else if(/401|403|credential|login/i.test(msg))
      actions.push({type:'human_gate',target:e.target||'unknown',reason:'credential_required'});
    else
      actions.push({type:'quarantine_and_diagnose',target:e.target||'unknown'});
  }
  for(const s of sources){
    if(s.status==='failed') actions.push({type:'fallback_source',target:s.source});
  }
  for(const e of executors){
    if(e.available && !e.credentialed) actions.push({type:'prepare_credential_path',target:e.source});
  }
  return {generated_at:new Date().toISOString(),actions};
}
