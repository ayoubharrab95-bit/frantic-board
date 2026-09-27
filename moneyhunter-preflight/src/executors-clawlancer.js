import { registerExecutor } from './executor.js';

async function request(url,options={}){
  const res=await fetch(url,options);
  const text=await res.text();
  let body; try{body=text?JSON.parse(text):{};}catch{body={raw:text};}
  if(!res.ok)throw new Error(`HTTP ${res.status}: ${body?.error||body?.message||text.slice(0,300)}`);
  return body;
}
export function registerClawlancerExecutor(){
  registerExecutor('clawlancer',{
    actions:['claim','deliver'],
    ready:()=>Boolean(process.env.CLAWLANCER_API_KEY),
    async execute(item,{action='claim',transaction_id,content}={}){
      const key=process.env.CLAWLANCER_API_KEY;
      if(!key)return{status:'human_gate',reason:'CLAWLANCER_API_KEY_missing'};
      const id=String(item.raw?.id||item.opportunity_id||item.id||'').replace(/^clawlancer-/,'');
      if(!id)return{status:'blocked',reason:'listing_id_missing'};
      const headers={accept:'application/json',authorization:`Bearer ${key}`,'content-type':'application/json','user-agent':'moneyhunter-preflight/0.6'};
      if(action==='claim')return{status:'claimed',source:'clawlancer',listing_id:id,claim:await request(`https://clawlancer.ai/api/listings/${encodeURIComponent(id)}/claim`,{method:'POST',headers})};
      if(action==='deliver'){
        if(!transaction_id||!content)return{status:'blocked',reason:'transaction_id_and_content_required'};
        return{status:'delivered',source:'clawlancer',transaction_id,delivery:await request(`https://clawlancer.ai/api/transactions/${encodeURIComponent(transaction_id)}/deliver`,{method:'POST',headers,body:JSON.stringify({content})})};
      }
      return{status:'blocked',reason:'unsupported_action'};
    }
  });
}
