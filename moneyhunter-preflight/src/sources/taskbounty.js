import { makeOpportunity } from '../opportunity.js';
import { boundedFetch } from './network.js';

const BASE='https://www.task-bounty.com/api/v1';

function rewardOf(x){
  const n=Number(x.bounty_cents ?? x.reward_cents ?? x.bounty_amount ?? x.reward ?? 0);
  if(!Number.isFinite(n)) return 0;
  return (x.bounty_cents!=null || x.reward_cents!=null || x.bounty_amount!=null) ? n/100 : n;
}

export function parseTaskBountyTasks(rows=[]){
  return rows.map((x,index)=>{
    const reward=rewardOf(x);
    const state=String(x.state||x.status||'open').toLowerCase();
    const closed=/closed|completed|cancelled|expired|paid|claimed/.test(state);
    const claims=Number(x.submission_count ?? x.claims ?? x.solvers ?? 0);
    const funded=x.funded!==false && !/unfunded|draft/.test(state);
    return makeOpportunity({
      id:`taskbounty-${x.id ?? index}`,
      source:'taskbounty',
      url:x.github_issue_url || x.url || (x.id ? `https://www.task-bounty.com/browse/${x.id}` : 'https://www.task-bounty.com/browse'),
      title:x.title || x.name || `TaskBounty task #${x.id ?? index}`,
      reward,
      currency:String(x.currency||'USD').toUpperCase(),
      status:!closed&&funded?'open':'closed',
      active_claims:claims,
      ai_policy:'allowed',
      payment_confidence:funded?0.93:0.45,
      competition_score:Math.max(0.08,1/(1+claims)),
      requires_manual_payment:false,
      claim_api_available:true,
      submit_api_available:true,
      estimated_minutes:Number(x.estimated_minutes||0)||undefined,
      raw:x
    });
  }).filter(x=>x.reward>0);
}

export async function discoverTaskBounty({limit=25,fetchImpl=fetch,apiKey=process.env.TASKBOUNTY_API_KEY}={}){
  const url=`${BASE}/tasks?state=open&limit=${Math.min(100,Math.max(1,limit*2))}`;
  const headers={accept:'application/json','user-agent':'moneyhunter-preflight/0.6'};
  if(apiKey) headers.authorization=`Bearer ${apiKey}`;
  const res=await boundedFetch(fetchImpl,url,{headers});
  if(!res.ok) throw new Error(`TaskBounty HTTP ${res.status}`);
  const json=await res.json();
  const rows=Array.isArray(json)?json:(json.tasks||json.items||json.data||[]);
  return parseTaskBountyTasks(rows).slice(0,limit);
}
export { rewardOf as parseTaskBountyReward };
