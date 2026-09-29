import { makeOpportunity } from '../opportunity.js';
import { boundedFetch } from './network.js';

const API='https://api.bountybook.ai';

function parseJob(job,index){
  const spec=typeof job.spec==='string' ? (()=>{try{return JSON.parse(job.spec)}catch{return {}}})() : (job.spec||{});
  const budget=Number(job.budget_usdc??job.budget??job.reward_usdc??0);
  if(!job.id||!Number.isFinite(budget)||budget<=0)return null;
  const escrow=String(job.escrow_status||job.escrow?.status||'').toLowerCase();
  const funded=escrow==='funded'||escrow==='secured'||Boolean(job.escrow?.funded);
  const instructions=String(spec.instructions||job.description||'');
  return makeOpportunity({
    id:`bountybook-${job.id}`,source:'bountybook',url:`${API}/jobs/${job.id}`,
    title:job.title||`BountyBook job ${index+1}`,reward:budget,currency:'USDC',
    status:job.status==='open'?'open':'unknown',ai_policy:'allowed',
    payment_confidence:funded?0.96:0.78,
    competition_score:Math.max(0.05,1/(1+Number(job.claims||job.active_claims||0))),
    requires_manual_payment:false,requires_wallet_signature:true,wallet_signature_mode:'agent_key',requires_spending:false,
    claim_api_available:true,submit_api_available:true,
    estimated_minutes:Number(job.estimated_minutes||job.estimatedMinutes||null)||null,
    raw:{job_id:job.id,spec,instructions,escrow_status:escrow,chain:job.chain||'Base (8453)',payout_network:'base',payout_asset:'USDC',payout_wallet_required:true,fee:'4% on successful verification'}
  });
}
export async function discoverBountyBook({limit=25,fetchImpl=fetch}={}){
  const res=await boundedFetch(fetchImpl,`${API}/jobs?status=open&limit=${Math.min(100,Math.max(1,limit*2))}`,{headers:{accept:'application/json','user-agent':'moneyhunter-preflight/1.0'}},15000);
  if(!res.ok)throw new Error(`BountyBook HTTP ${res.status}`);
  const json=await res.json();
  return (json.jobs||[]).map(parseJob).filter(Boolean).sort((a,b)=>(b.reward||0)-(a.reward||0)).slice(0,limit);
}
