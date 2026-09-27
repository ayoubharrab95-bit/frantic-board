import { runRadar } from './radar.js';
import { listExecutors, executeOpportunity } from './executor.js';
import { buildExecutionPlan } from './execution-policy.js';
import { enqueueOpportunity, updateExecution } from './revenue-memory.js';
import { buildStrategyState } from './strategy-engine.js';
import { runDevelopmentCycle } from './development-engine.js';
import { observeSourceStatus, filterAvailableSources, sourceHealth } from './source-health.js';

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
    const configuredSources=String(process.env.AUTO_HUNT_SOURCES||DEFAULT_SOURCES.join(',')).split(',').map(x=>x.trim()).filter(Boolean);
    const sources=filterAvailableSources(configuredSources);
    const radar=await runRadar({sources,minReward:Number(process.env.AUTO_HUNT_MIN_REWARD||5),limit:Number(process.env.AUTO_HUNT_LIMIT||25),useCache:false});
    for(const [source,status] of Object.entries(radar.source_status||{})) observeSourceStatus(source,status);
    const zeroCapital=buildZeroCapitalPlan(radar.opportunities||[]);
    const strategy=await buildStrategyState(radar.strategy?.portfolio||radar.opportunities||[]);
    const candidates=(strategy.ranked_opportunities||[]).map(item=>({...item,web_automation_available:Boolean(process.env.TINYFISH_API_KEY && (item.raw?.url||item.url||item.external_link||item.raw?.issue_url)),tinyfish_url:item.raw?.url||item.url||item.external_link||item.raw?.issue_url||null}));
    const plan=buildExecutionPlan(candidates);
    const executors=listExecutors(),queued=[],gated=[],ready=[],attempted=[];
    let development=null;
    for(const plannedItem of plan){
      if(plannedItem.policy?.action==='reject')continue;
      // If the preferred headless API executor is not credentialed, fall back to the
      // credentialed TinyFish browser executor when the opportunity has a usable URL.
      // This removes a dead-end where a valid paid opportunity was discovered but
      // could never execute simply because one source-specific API token was absent.
      const tinyfish=executors.find(x=>x.source==='tinyfish');
      const apiExecutor=plannedItem.policy?.action==='api_execute' ? executors.find(x=>x.source===plannedItem.source) : null;
      const canWebFallback=plannedItem.policy?.action==='api_execute'
        && !apiExecutor?.credentialed
        && tinyfish?.credentialed
        && Boolean(plannedItem.web_automation_available && plannedItem.tinyfish_url);
      const item=canWebFallback
        ? {...plannedItem,policy:{action:'web_execute',reason:'tinyfish_fallback_for_uncredentialed_api_executor'}}
        : plannedItem;
      const row=await enqueueOpportunity(item); queued.push(row);
      if(item.policy?.action==='api_execute'||item.policy?.action==='web_execute'){
        const payoutOk=Number(item.payment_confidence ?? 0) >= Number(process.env.AUTO_EXECUTE_MIN_PAYMENT_CONFIDENCE||0.80);
        const noManualPayout=!item.requires_manual_payment;
        const ex=item.policy?.action==='web_execute' ? executors.find(x=>x.source==='tinyfish') : executors.find(x=>x.source===item.source);
        if(ex?.credentialed && payoutOk && noManualPayout){
          ready.push({opportunity:item,row});
          if(process.env.AUTO_EXECUTE_CLAIMS==='true'){
            try{
              const actionBySource={frantic:'claim',taskbounty:'claim_access',clawlancer:'claim',mya:'apply',basedagents:'claim',algora:'claim',opire:'claim'};
              const action=item.policy?.action==='web_execute'?'web_execute':(actionBySource[item.source]||'claim');
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
    lastRun={at:new Date().toISOString(),duration_ms:Date.now()-started,found:radar.count,zero_capital_found:zeroCapital.count,zero_capital_top:zeroCapital.opportunities.slice(0,5),queued:queued.length,ready:ready.length,attempted:attempted.length,gated:gated.length,gated_reasons:gated,source_status:radar.source_status,source_health:sourceHealth(),development:development?.result||null};
    console.log(JSON.stringify({event:'auto_hunter_cycle',...lastRun}));
    return {status:'ok',summary:lastRun,radar,zero_capital:zeroCapital,strategy,executors,development};
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
