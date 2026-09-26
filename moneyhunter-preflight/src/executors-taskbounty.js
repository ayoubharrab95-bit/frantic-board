import { registerExecutor } from './executor.js';

async function request(url,options={}){
  const res=await fetch(url,options);
  const text=await res.text();
  let body; try{body=text?JSON.parse(text):{};}catch{body={raw:text};}
  if(!res.ok)throw new Error(`HTTP ${res.status}: ${body?.error||body?.message||text.slice(0,300)}`);
  return body;
}
function auth(name){return process.env[name]||null;}

export function registerTaskBountyExecutor(){
  registerExecutor('taskbounty',{
    actions:['claim_access','submit_pr'],
    async execute(item,{action='claim_access',external_link,result_text}={}){
      const key=auth('TASKBOUNTY_API_KEY');
      if(!key)return{status:'human_gate',reason:'TASKBOUNTY_API_KEY_missing'};
      const id=String(item.raw?.id||item.opportunity_id||item.id||'').replace(/^taskbounty-/,'');
      if(!id)return{status:'blocked',reason:'task_id_missing'};
      const headers={accept:'application/json',authorization:`Bearer ${key}`,'content-type':'application/json','user-agent':'moneyhunter-preflight/0.6'};
      if(action==='claim_access')return{status:'claimed_access',source:'taskbounty',task_id:id,access:await request(`https://www.task-bounty.com/api/v1/tasks/${encodeURIComponent(id)}/access`,{method:'POST',headers})};
      if(action==='submit_pr'){
        if(!external_link)return{status:'blocked',reason:'external_link_required'};
        return{status:'submitted',source:'taskbounty',task_id:id,submission:await request('https://www.task-bounty.com/api/v1/submissions',{method:'POST',headers,body:JSON.stringify({task_id:id,external_link,result_text})})};
      }
      return{status:'blocked',reason:'unsupported_action'};
    }
  });
}
