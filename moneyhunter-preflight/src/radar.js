import { discoverFrantic } from './sources/frantic.js';
import { discoverGitHubPaid } from './sources/github-paid.js';
import { discoverAlgora } from './sources/algora.js';
import { discoverOpire } from './sources/opire.js';
import { discoverClawlancer } from './sources/clawlancer.js';
import { discoverMya } from './sources/mya.js';
import { discoverBasedAgents } from './sources/basedagents.js';
import { discoverTaskBounty } from './sources/taskbounty.js';
import { discoverBaseBounty } from './sources/basebounty.js';
import { discoverGitLawBounty } from './sources/gitlawbounty.js';
import { opportunityKey } from './opportunity.js';
import { buildStrategyPlan, improvementProposals, enrichEconomics, setSourcePriors } from './strategy.js';
import { getSourcePriors, enqueueOpportunity } from './revenue-memory.js';

const SOURCES=['taskbounty','basedagents','basebounty','frantic','github','algora','opire','clawlancer','mya','gitlawbounty'];
const CACHE_TTL_MS=Number(process.env.RADAR_CACHE_TTL_MS||60000),cache=new Map();
const clamp=(x)=>Math.max(0,Math.min(1,Number(x)||0));
function normalizedCompetition(i){if(i.competition_score!=null)return clamp(i.competition_score);return 1/(1+(i.active_claims??0));}
function normalizedPayment(i){if(i.payment_confidence!=null)return clamp(i.payment_confidence);return i.source==='frantic'?0.9:0.4;}
function aiMultiplier(i){return i.ai_policy==='prohibited'?0:i.ai_policy==='allowed'?1:0.72;}
function expectedValue(i){const reward=Math.max(0,Number(i.reward)||0),payment=normalizedPayment(i),competition=normalizedCompetition(i),ai=aiMultiplier(i),manual=i.requires_manual_payment?0.7:1,open=i.status==='open'?1:0;return reward*payment*competition*ai*manual*open;}
async function safe(label,fn){try{return{label,items:await fn(),error:null}}catch(error){return{label,items:[],error:error instanceof Error?error.message:String(error)}}}
function cacheKey({sources,minReward,limit}){return JSON.stringify({sources:[...sources].sort(),minReward,limit});}
export function clearRadarCache(){cache.clear();}
export async function runRadar({sources=SOURCES,minReward=5,limit=25,useCache=true}={}){
 const params={sources:[...new Set(sources)].filter(s=>SOURCES.includes(s)),minReward:Math.max(0,Number(minReward)||0),limit:Math.min(100,Math.max(1,Number(limit)||25))};
 const key=cacheKey(params),cached=cache.get(key);if(useCache&&cached&&Date.now()-cached.at<CACHE_TTL_MS)return{...cached.value,cached:true};
 const priors=await getSourcePriors(); setSourcePriors(priors);
 const jobs=[];
 if(params.sources.includes('frantic'))jobs.push(safe('frantic',()=>discoverFrantic({limit:params.limit})));
 if(params.sources.includes('github'))jobs.push(safe('github',()=>discoverGitHubPaid({limit:params.limit})));
 if(params.sources.includes('algora'))jobs.push(safe('algora',()=>discoverAlgora({limit:params.limit})));
 if(params.sources.includes('opire'))jobs.push(safe('opire',()=>discoverOpire({limit:params.limit})));
 if(params.sources.includes('clawlancer'))jobs.push(safe('clawlancer',()=>discoverClawlancer({limit:params.limit})));
 if(params.sources.includes('mya'))jobs.push(safe('mya',()=>discoverMya({limit:params.limit})));
 if(params.sources.includes('basedagents'))jobs.push(safe('basedagents',()=>discoverBasedAgents({limit:params.limit})));
 if(params.sources.includes('taskbounty'))jobs.push(safe('taskbounty',()=>discoverTaskBounty({limit:params.limit})));
 if(params.sources.includes('basebounty'))jobs.push(safe('basebounty',()=>discoverBaseBounty({limit:params.limit,minReward:params.minReward})));
 if(params.sources.includes('gitlawbounty'))jobs.push(safe('gitlawbounty',()=>discoverGitLawBounty({limit:params.limit,minReward:params.minReward})));
 const batches=await Promise.all(jobs),found=batches.flatMap(b=>b.items),seen=new Set(),deduped=[];
 for(const item of found){const k=opportunityKey(item);if(seen.has(k))continue;seen.add(k);deduped.push(item);}
 const opportunities=deduped.filter(i=>i.status==='open'&&i.ai_policy!=='prohibited'&&(i.reward??0)>=params.minReward)
  .filter(i=>Number(i.payment_confidence ?? 0) >= Number(process.env.MIN_PAYMENT_CONFIDENCE||0.20))
  .map(i=>{
  const payment=normalizedPayment(i),competition=normalizedCompetition(i),ev=expectedValue(i);
  return{...i,expected_value_usd:Number(ev.toFixed(2)),radar_score:Number((ev*Math.max(.25,payment)*Math.max(.25,competition)).toFixed(2)),payment_confidence:Number(payment.toFixed(2)),competition_score:Number(competition.toFixed(2)),economics:enrichEconomics({...i,payment_confidence:payment,competition_score:competition})};
 }).filter(i=>i.expected_value_usd>0).sort((a,b)=>b.economics.expected_hourly_usd-a.economics.expected_hourly_usd||b.radar_score-a.radar_score||b.expected_value_usd-a.expected_value_usd).slice(0,params.limit);
 const sourceStatus=Object.fromEntries(batches.map(b=>[b.label,b.error?{ok:false,error:b.error}:{ok:true,found:b.items.length}])),
  weakSources=Object.entries(sourceStatus).filter(([,s])=>!s.ok||s.found===0).map(([name,s])=>({source:name,action:s.ok?'expand_discovery':'repair_or_deprioritize',reason:s.error||'source returned no qualifying opportunities'})),strategy=buildStrategyPlan({opportunities,sourceStatus});
 if(process.env.AUTO_QUEUE_OPPORTUNITIES==='true'){for(const item of strategy.portfolio){try{await enqueueOpportunity(item)}catch{}}}
 strategy.source_actions=[...(strategy.source_actions||[]),...weakSources];
 const value={generated_at:new Date().toISOString(),strategy_revision:strategy.strategy_revision,requested_sources:params.sources,source_status:sourceStatus,count:opportunities.length,opportunities,strategy,improvement_proposals:improvementProposals({sourceStatus,opportunities}),cached:false};
 cache.set(key,{at:Date.now(),value});return value;
}