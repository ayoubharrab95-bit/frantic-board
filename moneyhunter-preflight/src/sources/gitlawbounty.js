const BASE='https://gitlawbounty.xyz/api';
const clamp=(n)=>Math.max(0,Math.min(1,Number(n)||0));

async function get(path){
  const r=await fetch(BASE+path,{headers:{accept:'application/json'},signal:AbortSignal.timeout(12000)});
  if(!r.ok)throw new Error('gitlawbounty_http_'+r.status);
  return r.json();
}

export async function discoverGitLawBounty({limit=25,minReward=0}={}){
  const data=await get('/bounties');
  const rows=Array.isArray(data)?data:(data.bounties||data.items||[]);
  return rows.slice(0,limit).map(x=>{
    const reward=Number(x.reward_usd??x.reward??x.amount??0);
    const status=String(x.status??'open').toLowerCase();
    return {
      id:'gitlaw-'+String(x.id??x.uuid??x.slug),
      source:'gitlawbounty',
      title:String(x.title??x.name??'GitLaw bounty'),
      url:String(x.url??('https://gitlawbounty.xyz/bounty/'+(x.id??''))),
      reward,
      currency:String(x.currency??'USDC'),
      status:status.includes('closed')?'closed':'open',
      ai_policy:x.ai_allowed===false?'prohibited':'unknown',
      payment_confidence:clamp(x.funded===true||x.escrowed===true?0.95:x.onchain===true?0.9:0.65),
      requires_manual_payment:false,
      competition_score:clamp(1/(1+Number(x.claims??x.active_claims??0))),
      effort_hours:Math.max(.25,Number(x.effort_hours??x.estimated_hours??2)),
      raw:x
    };
  }).filter(x=>x.reward>=minReward && x.status==='open');
}

export async function gitLawHealth(){try{await get('/manifest');return{ok:true,source:'gitlawbounty'}}catch(e){return{ok:false,source:'gitlawbounty',error:String(e)}}}
