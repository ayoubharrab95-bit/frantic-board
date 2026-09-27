import { runRadar } from './radar.js';
import { listExecutors, executeOpportunity } from './executor.js';
import { buildExecutionPlan } from './execution-policy.js';
import { enqueueOpportunity, updateExecution } from './revenue-memory.js';
import { buildStrategyState } from './strategy-engine.js';
import { runDevelopmentCycle } from './development-engine.js';

let running=false;
let timer=null;
let lastRun=null;
let lastError=null;
const DEFAULT_SOURCES=['frantic','github','algora','opire','clawlancer','mya','basedagents','taskbounty','basebounty','gitlawbounty'];

async function huntOnce(){
  if(running)return {status:'busy',last_run:lastRun,last_error:lastError};
  running=true; lastError=null;
  const started=Date.now();
  try{
    const sources=String(process.env.AUTO_HUNT_SOURCES||DEFAULT_SOURCES.join(',')).split(',').map(x=>x.trim()).filter(Boolean);
    const radar=await runRadar({sources,minReward:Number(process.env.AUTO_HUNT_MIN_REWARD||5),limit:Number(process.env.AUTO_HUNT_LIMIT||25),useCache:false});
    const strategy=await buildStrategyState(radar.strategy?.portfolio||radar.opportunities||[]);
    const candidates=strategy.ranked_opportunities;
    const plan=buildExecutionPlan(candidates);
    const executors=listExecutors(),queued=[],gated=[],ready=[],attempted=[];
    let development=null;
    for(const item of plan){
      if(item.policy?.action==='reject')continue;
      const row=await enqueueOpportunity(item); queued.push(row);
      if(item.policy?.action==='api_execute'){
        const payoutOk=Number(item.payment_confidence ?? 0) >= Number(process.env.AUTO_EXECUTE_MIN_PAYMENT_CONFIDENCE||0.80);
        const noManualPayout=!item.requires_manual_payment;
        const ex=executors.find(x=>x.source===item.source);
        if(ex?.credentialed && payoutOk && noManualPayout){
          ready.push({opportunity:item,row});
          if(process.env.AUTO_EXECUTE_CLAIMS==='true'){
            try{
              const actionBySource={frantic:'claim',taskbounty:'claim_access',clawlancer:'claim',mya:'apply',basedagents:'claim',algora:'claim',opire:'claim'};
              const action=actionBySource[item.source]||'claim';
              const result=await executeOpportunity(item,{dryRun:false,action,pr_url:item.raw?.pr_url,issue_number:item.raw?.issue_number});
              attempted.push({id:item.id,source:item.source,result});
              await updateExecution(row.id,{status:result.status||'attempted',last_result:result});
            }catch(error){
              attempted.push({id:item.id,source:item.source,error:String(error)});
              await updateExecution(row.id,{status:'error',last_error:String(error)});
            }
          }
        }else gated.push({source:item.source,id:item.id,reason:!ex?.credentialed?'executor_not_credentialed':!payoutOk?'payment_confidence_below_auto_threshold':'manual_payment'});
      }
    }
    if(ready.length===0 || candidates.length===0 || gated.length>=Math.max(1,plan.length)){
      development=await runDevelopmentCycle({sourceStatus:radar.source_status,executors});
    }
    lastRun={at:new Date().toISOString(),duration_ms:Date.now()-started,found:radar.count,queued:queued.length,ready:ready.length,attempted:attempted.length,gated:gated.length,source_status:radar.source_status,development:development?.result||null};
    console.log(JSON.stringify({event:'auto_hunter_cycle',...lastRun}));
    return {status:'ok',summary:lastRun,radar,strategy,executors,development};
  }catch(error){
    lastError=String(error);
    console.error(JSON.stringify({event:'auto_hunter_error',error:lastError}));
    return {status:'error',error:lastError,last_run:lastRun};
  }finally{running=false;}
}

export function startAutoHunter(){
  if(process.env.AUTO_HUNT!=='true')return {enabled:false,status:()=>({enabled:false,last_run:lastRun,last_error:lastError})};
  const interval=Math.max(300000,Number(process.env.AUTO_HUNT_INTERVAL_MS||300000));
  if(!timer){
    timer=setInterval(()=>huntOnce().catch(error=>console.error(JSON.stringify({event:'auto_hunter_unhandled',error:String(error)}))),interval);
    huntOnce().catch(error=>console.error(JSON.stringify({event:'auto_hunter_initial_error',error:String(error)})));
  }
  return {enabled:true,interval_ms:interval,status:()=>({enabled:true,running,last_run:lastRun,last_error:lastError,interval_ms:interval})};
}
export { huntOnce };
