const HUMAN_GATES=new Set(['login','2fa','wallet_signature','spending','kyc','legal_consent','irreversible_action']);
export function classifyExecution(item={}){
  if(item.ai_allowed===false)return{action:'reject',reason:'ai_not_allowed'};
  if(item.requires_manual_payment)return{action:'human_gate',reason:'manual_payment'};
  if(item.requires_login)return{action:'human_gate',reason:'login'};
  if(item.requires_2fa)return{action:'human_gate',reason:'2fa'};
  if(item.requires_wallet_signature)return{action:'human_gate',reason:'wallet_signature'};
  if(item.requires_spending)return{action:'human_gate',reason:'spending'};
  if(item.requires_kyc)return{action:'human_gate',reason:'kyc'};
  if(item.requires_legal_consent)return{action:'human_gate',reason:'legal_consent'};
  if(item.irreversible)return{action:'human_gate',reason:'irreversible_action'};
  if(item.claim_requires_pr && !item.raw?.pr_url)return{action:'prepare',reason:'pr_required_before_claim'};
  if(item.claim_api_available||item.submit_api_available)return{action:'api_execute',reason:'headless_api_available'};
  return{action:'prepare',reason:'api_not_confirmed'};
}
export function buildExecutionPlan(queue=[]){
 return queue.map(item=>({...item,policy:classifyExecution(item)}));
}
export { HUMAN_GATES };
