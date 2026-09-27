import { runRadar } from './radar.js';
import { listExecutors, executeOpportunity } from './executor.js';
import { buildExecutionPlan } from './execution-policy.js';
import { enqueueOpportunity, updateExecution } from './revenue-memory.js';

let running=false;
let timer=null;
let lastRun=null;
const DEFAULT_SOURCES=['frantic','github','algora','opire','clawlancer','mya','basedagents','taskbounty','basebounty'];

async function huntOnce(){
  if(running)return {status:'busy',last_run:lastRun};
  running=true;
  try{
    const sources=String(process.env.AUTO_HUNT_SOURCES||DEFAULT_SOURCES.join(',')).split(',').map(x=>x.trim()).filter(Boolean);
    const radar=await runRadar({sources,minReward:Number(process.env.AUTO_HUNT_MIN_REWARD||5),limit:Number(process.env.AUTO_HUNT_LIMIT||25),useCache:false});
    const plan=buildExecutionPlan(radar.strategy?.portfolio||radar.opportunities||[]);
    const executors=listExecutors(),queued=[],gated=[],ready=[];
    for(const item of plan){
      if(item.policy?.action==='reject')continue;
      const row=await enqueueOpportunity(item); queued.push(row);
      if(item.policy?.action==='api_execute'){
        const ex=executors.find(x=>x.source===item.source);
        if(ex?.credentialed){
          ready.push({opportunity:item,row});
          if(process.env.AUTO_EXECUTE_CLAIMS==='true'){
            try{
              const actionBySource={frantic:'claim',taskbounty:'claim_access',clawlancer:'claim',mya:'apply',basedagents:'claim',algora:'claim',opire:'claim'};
              const action=actionBySource[item.source]||'claim';
              const result=await executeOpportunity(item,{dryRun:false,action,pr_url:item.raw?.pr_url,issue_number:item.raw?.issue_number});
              await updateExecution(row.id,{status:result.status||'attempted',last_result:result});
            }catch(error){
              await updateExecution(row.id,{status:'error',last_error:String(error)});
            }
          }
        }else gated.push({source:item.source,id:item.id,reason:'executor_not_credentialed'});
      }
    }
    lastRun={at:new Date().toISOString(),found:radar.count,queued:queued.length,ready:ready.length,gated:gated.length,source_status:radar.source_status};
    return {status:'ok',summary:lastRun,radar,executors};
  } finally { running=false; }
}

export function startAutoHunter(){
  if(process.env.AUTO_HUNT!=='true')return {enabled:false};
  const interval=Math.max(300000,Number(process.env.AUTO_HUNT_INTERVAL_MS||900000));
  if(!timer){timer=setInterval(()=>huntOnce().catch(()=>{}),interval);huntOnce().catch(()=>{});}
  return {enabled:true,interval_ms:interval,last_run:lastRun};
}
export { huntOnce };
