import { privateKeyToAccount } from 'viem/accounts';
import { registerExecutor } from './executor.js';

const API='https://api.bountybook.ai';
let session=null;

function account(){
  const key=process.env.BOUNTYBOOK_AGENT_PRIVATE_KEY;
  if(!key)return null;
  return privateKeyToAccount(key.startsWith('0x')?key:`0x${key}`);
}

async function authenticate(){
  const a=account();
  if(!a)return null;
  if(session && session.address===a.address && session.expiresAt>Date.now()+60000)return session;
  const nonceRes=await fetch(`${API}/auth/nonce?address=${encodeURIComponent(a.address)}`,{headers:{accept:'application/json'}});
  const nonceJson=await nonceRes.json();
  if(!nonceRes.ok)throw new Error(`BountyBook nonce HTTP ${nonceRes.status}: ${nonceJson?.error||nonceJson?.message||'unknown'}`);
  const signature=await a.signMessage({message:String(nonceJson.nonce)});
  const verifyRes=await fetch(`${API}/auth/verify`,{method:'POST',headers:{'content-type':'application/json',accept:'application/json'},body:JSON.stringify({address:a.address,signature})});
  const verifyJson=await verifyRes.json();
  if(!verifyRes.ok)throw new Error(`BountyBook auth HTTP ${verifyRes.status}: ${verifyJson?.error||verifyJson?.message||'unknown'}`);
  session={address:a.address,token:verifyJson.token,expiresAt:Date.now()+50*60*1000};
  return session;
}

async function api(path,method='POST',body){
  const s=await authenticate();
  if(!s)return {status:'human_gate',reason:'BOUNTYBOOK_AGENT_PRIVATE_KEY_missing'};
  const res=await fetch(`${API}${path}`,{method,headers:{accept:'application/json','content-type':'application/json',Authorization:`Bearer ${s.token}`},body:body===undefined?undefined:JSON.stringify(body)});
  const raw=await res.text();
  let data={}; try{data=raw?JSON.parse(raw):{}}catch{data={raw}};
  if(!res.ok)throw new Error(`BountyBook HTTP ${res.status}: ${data?.error||data?.message||raw.slice(0,300)}`);
  return data;
}

export function bountyBookAgentAddress(){
  return account()?.address||null;
}

export function registerBountyBookExecutor(){
  registerExecutor('bountybook',{
    actions:['authenticate','claim','submit'],
    ready:()=>Boolean(account()),
    async execute(item,{action='claim',content,summary,artifact_refs}={}){
      const id=String(item.raw?.job_id||item.opportunity_id||item.id||'').replace(/^bountybook-/,'');
      const a=account();
      if(!a)return{status:'human_gate',reason:'BOUNTYBOOK_AGENT_PRIVATE_KEY_missing'};
      if(!id)return{status:'blocked',reason:'job_id_missing'};
      if(action==='authenticate')return{status:'authenticated',source:'bountybook',address:a.address,session:await authenticate()};
      if(action==='claim')return{status:'claimed',source:'bountybook',job_id:id,executor_address:a.address,claim:await api(`/jobs/${encodeURIComponent(id)}/claim`,'POST',{executorAddress:a.address,txHash:'0x'})};
      if(action==='submit'){
        const outputData=artifact_refs?{content:content||summary||'',artifact_refs}: {content:content||summary||''};
        return{status:'submitted',source:'bountybook',job_id:id,executor_address:a.address,submission:await api(`/jobs/${encodeURIComponent(id)}/submit`,'POST',{executorAddress:a.address,outputData})};
      }
      return{status:'blocked',reason:'unsupported_action'};
    }
  });
}
