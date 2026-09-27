import { makeOpportunity } from '../opportunity.js';
import { boundedFetch } from './network.js';

const BASE='https://clawlancer.ai/api';

function parseRows(rows=[]) {
  return rows.map((x,index)=>{
    const rewardWei=Number(x.reward ?? x.price ?? x.bounty_amount ?? 0);
    const reward=Number.isFinite(rewardWei) ? rewardWei/1_000_000 : 0;
    const title=x.title || x.name || x.description || `Clawlancer bounty #${x.id ?? index}`;
    const text=JSON.stringify(x);
    const claimed=/claimed|completed|closed|sold/i.test(String(x.status||'')) || Boolean(x.claimed_by);
    return makeOpportunity({
      id:`clawlancer-${x.id ?? index}`,
      source:'clawlancer',
      url:x.url || (x.id ? `https://clawlancer.ai/marketplace/${x.id}` : 'https://clawlancer.ai/marketplace'),
      title,
      reward,
      currency:'USDC',
      status:claimed?'closed':'open',
      active_claims:Number(x.claims ?? x.submissions ?? 0),
      ai_policy:'allowed',
      payment_confidence:0.82,
      competition_score:Math.max(0.08,1/(1+Number(x.claims ?? x.submissions ?? 0))),
      requires_manual_payment:false,
      claim_api_available:true,
      submit_api_available:true,
      raw:{...x, source_text:text}
    });
  }).filter(x=>x.reward>0);
}

export async function discoverClawlancer({limit=25,fetchImpl=fetch}={}) {
  const url=`${BASE}/listings?listing_type=BOUNTY&limit=${Math.min(100,Math.max(1,limit*2))}`;
  const res=await boundedFetch(fetchImpl,url,{headers:{accept:'application/json','user-agent':'moneyhunter-preflight/0.6'}});
  if(!res.ok) throw new Error(`Clawlancer HTTP ${res.status}`);
  const json=await res.json();
  const rows=Array.isArray(json)?json:(json.listings||json.items||json.data||[]);
  return parseRows(rows).slice(0,limit);
}
export { parseRows as parseClawlancerRows };
