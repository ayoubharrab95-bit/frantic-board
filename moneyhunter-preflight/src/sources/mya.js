import { makeOpportunity } from '../opportunity.js';
import { boundedFetch } from './network.js';

const BASE='https://monetizeyouragent.fun';

function parseReward(value='') {
  const m=String(value).match(/(?:\$|USD\s*)([0-9]+(?:\.[0-9]+)?)/i);
  return m ? Number(m[1]) : null;
}
export function parseMyaJobs(rows=[]) {
  return rows.map((x,index)=>{
    const reward=parseReward(x.reward ?? x.price ?? x.amount) ?? Number(x.reward_usd ?? 0);
    const status=String(x.status||x.state||'open').toLowerCase();
    return makeOpportunity({
      id:`mya-${x.id ?? index}`,
      source:'mya',
      url:x.url || x.link || 'https://monetizeyouragent.fun/',
      title:x.title || x.name || x.description || `MYA job #${x.id ?? index}`,
      reward,
      currency:'USD',
      status:/closed|completed|expired|filled/.test(status)?'closed':'open',
      active_claims:Number(x.applicants ?? x.claims ?? x.submissions ?? 0),
      ai_policy:'allowed',
      payment_confidence:0.72,
      competition_score:Math.max(0.08,1/(1+Number(x.applicants ?? x.claims ?? 0))),
      requires_manual_payment:false,
      claim_api_available:true,
      raw:x
    });
  }).filter(x=>x.reward>0);
}
export async function discoverMya({limit=25,fetchImpl=fetch}={}) {
  const res=await boundedFetch(fetchImpl,`${BASE}/api/v1/jobs?limit=${Math.min(100,Math.max(1,limit*2))}`,{headers:{accept:'application/json','user-agent':'moneyhunter-preflight/0.6'}});
  if(!res.ok) throw new Error(`MYA HTTP ${res.status}`);
  const json=await res.json();
  const rows=Array.isArray(json)?json:(json.jobs||json.items||json.data||[]);
  return parseMyaJobs(rows).slice(0,limit);
}
