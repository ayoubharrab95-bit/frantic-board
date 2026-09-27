export async function discoverBaseBounty({limit=25,minReward=0}={}){
 const url=new URL(process.env.BASEBOUNTY_DISCOVERY_URL||'https://basebounty-facade.vercel.app/v1/bounties');
 url.searchParams.set('status','open');url.searchParams.set('limit',String(Math.min(100,Math.max(1,limit))));url.searchParams.set('minReward',String(Math.max(0,minReward)));
 const res=await fetch(url,{headers:{accept:'application/json','user-agent':'moneyhunter-preflight/0.8'}});
 const raw=await res.text();let body;try{body=raw?JSON.parse(raw):{}}catch{body={raw};}
 if(!res.ok)throw new Error('HTTP '+res.status+': '+(body?.error||body?.message||raw.slice(0,200)));
 const list=Array.isArray(body)?body:(body.bounties||body.data||body.items||[]);
 return list.map(b=>({id:'basebounty-'+String(b.jobId||b.id),source:'basebounty',status:b.status||'open',reward:Number(b.reward?.usdc??b.reward??0),currency:'USDC',network:'base',title:b.title||b.name||('BaseBounty #'+String(b.jobId||b.id)),description:b.description||'',category:b.category||'other',tags:Array.isArray(b.tags)?b.tags:[],ai_policy:'allowed',requires_manual_payment:false,requires_auth:true,claim_api_available:true,submit_api_available:true,raw:b,external_url:'https://www.basebounty.app/' }));
}
