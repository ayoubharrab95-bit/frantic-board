import { makeOpportunity } from '../opportunity.js';
import { boundedFetch } from './network.js';

const BASE='https://api.basedagents.ai';

function parseTasks(rows=[]) {
  return rows.map((x,index)=>{
    const amount=Number(x.bounty?.amount_display ?? x.bounty?.amount ?? x.reward ?? 0);
    const reward=Number.isFinite(amount) && amount>1000 && !x.bounty?.amount_display ? amount/1_000_000 : amount;
    const payment=String(x.payment_status||x.bounty?.payment_status||x.escrow?.status||'');
    const funded=/funded|escrowed|settled/i.test(payment);
    const claimable=x.claimable!==false && !x.claimer_id && !x.claimer;
    return makeOpportunity({
      id:`basedagents-${x.id ?? index}`,
      source:'basedagents',
      url:x.url || `https://basedagents.ai/tasks/${x.id ?? ''}`,
      title:x.title || `BasedAgents task #${x.id ?? index}`,
      reward,
      currency:'USDC',
      status:claimable && (funded || x.bounty?.amount_display) ? 'open' : 'unverified',
      active_claims:x.claim_count ?? (x.claimer ? 1 : 0),
      ai_policy:'allowed',
      payment_confidence:funded?0.96:0.72,
      competition_score:Math.max(0.08,1/(1+Number(x.claim_count||0))),
      requires_manual_payment:false,
      raw:x
    });
  }).filter(x=>x.reward>0);
}

export async function discoverBasedAgents({limit=25,fetchImpl=fetch}={}) {
  const url=`${BASE}/v1/tasks?status=open&limit=${Math.min(100,Math.max(1,limit*2))}`;
  const res=await boundedFetch(fetchImpl,url,{headers:{accept:'application/json','user-agent':'moneyhunter-preflight/0.6'}});
  if(!res.ok) throw new Error(`BasedAgents HTTP ${res.status}`);
  const json=await res.json();
  const rows=Array.isArray(json)?json:(json.tasks||json.items||json.data||[]);
  return parseTasks(rows).slice(0,limit);
}
export { parseTasks as parseBasedAgentsTasks };
