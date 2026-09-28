import http from 'node:http';
import { analyzeIssueUrl } from './analyze.js';
import { runRadar } from './radar.js';
import { revenueChannels, buildRevenuePortfolio } from './channels.js';
import { revenueLanes, buildRevenuePlan } from './revenue-engine.js';
import { PRICING, PUBLIC_MANIFEST, LLMS_TEXT, OPENAPI } from './product.js';
import { revenueOffers } from './offers.js';
import { revenueMemorySummary, recordOutcome, enqueueOpportunity, updateExecution, executionQueue, readLedger } from './revenue-memory.js';
import { buildExecutionPlan } from './execution-policy.js';
import { listExecutors, executorStatus, executeOpportunity } from './executor.js';
import { registerTaskBountyExecutor } from './executors-taskbounty.js';
import { registerClawlancerExecutor } from './executors-clawlancer.js';
import { registerFranticExecutor } from './executors-frantic.js';
import { registerMyaExecutor } from './executors-mya.js';
import { registerBasedAgentsExecutor } from './executors-basedagents.js';
import { registerGitHubClaimExecutors } from './executors-github-claims.js';
import { registerGitHubExecutor } from './executors-github.js';
import { startAutoHunter, huntOnce } from './auto-hunter.js';
import { hourlyReportStatus, buildHourlyReport } from './hourly-report.js';
import { incomeEngines, buildIncomePlan, buildIncomeSnapshot } from './income-orchestrator.js';
import { scoreLead, buildLeadOffer } from './leadforge.js';
import { apiCatalog, apiEconomics } from './apiforge.js';
import { scoreCommission } from './commissionforge.js';
import { scanMarkets } from './market-radar.js';
import { buildCapitalPlan } from './capital-engine.js';
import { buildExpansionPlan } from './expansion-engine.js';
import { buildStrategyState } from './strategy-engine.js';
import { buildAutonomyPolicy, autonomyDecision, buildSelfHealingPlan } from './autonomy-engine.js';
import { buildDevelopmentPlan, runDevelopmentCycle, developmentStatus } from './development-engine.js';
import { sourceHealth } from './source-health.js';
import { buildZeroCapitalPlan, buildCommerceOffers } from './zero-capital-engine.js';
import { revenueLanes, buildRevenueLanes } from './revenue-lanes.js';
import { listServices, executeService } from './services.js';
import { treasuryStatus, treasuryPolicy } from './treasury.js';
import { payoutOverview, payoutRegistry, payoutRoute } from './payout-router.js';
import { ensureBasedAgentsIdentity } from './basedagents-bootstrap.js';
await ensureBasedAgentsIdentity();
registerTaskBountyExecutor(); registerClawlancerExecutor(); registerFranticExecutor(); registerMyaExecutor(); registerBasedAgentsExecutor(); registerGitHubClaimExecutors(); registerGitHubExecutor();
const autoHunter=startAutoHunter();
import { observeRequest,observePreflight,observeRadar,observePaymentCheck,snapshotMetrics } from './observability.js';
const port=Number(process.env.PORT||8787);
const headers=t=>({'content-type':t,'access-control-allow-origin':'*','access-control-allow-headers':'content-type, authorization, payment-signature','access-control-allow-methods':'GET,POST,OPTIONS'});
const json=(res,status,body,extra={})=>{const e=JSON.stringify(body,null,2);res.writeHead(status,{...headers('application/json; charset=utf-8'),'content-length':Buffer.byteLength(e),...extra});res.end(e)};
const text=(res,status,body,t='text/plain; charset=utf-8')=>{res.writeHead(status,{...headers(t),'content-length':Buffer.byteLength(body)});res.end(body)};
async function readJson(req){let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>64000)throw new Error('Request body too large.')}return raw?JSON.parse(raw):{}}
function parseRadarQuery(s='/'){const u=new URL(s,'http://localhost'),minReward=Number(u.searchParams.get('min_reward')||5),limit=Number(u.searchParams.get('limit')||25),sources=(u.searchParams.get('sources')||'frantic,github,algora,opire,clawlancer,mya,basedagents,taskbounty,basebounty,bountybook,gitlawbounty').split(',').map(x=>x.trim()).filter(Boolean);return{minReward:Number.isFinite(minReward)?Math.max(0,minReward):5,limit:Number.isFinite(limit)?Math.min(100,Math.max(1,limit)):25,sources}}
const server=http.createServer(async(req,res)=>{
 observeRequest();
 if(req.method==='OPTIONS')return json(res,204,{});
 if(req.method==='GET'&&req.url==='/')return json(res,200,PUBLIC_MANIFEST);
 if(req.method==='GET'&&req.url==='/health')return json(res,200,{ok:true,service:'moneyhunter-preflight',version:PUBLIC_MANIFEST.version,features:PUBLIC_MANIFEST.features});
 if(req.method==='GET'&&req.url==='/llms.txt')return text(res,200,LLMS_TEXT);
 if(req.method==='GET'&&req.url==='/openapi.json')return json(res,200,OPENAPI);
 if(req.method==='GET'&&req.url==='/v1/pricing')return json(res,200,PRICING,{'cache-control':'public, max-age=300'});
 if(req.method==='GET'&&req.url==='/v1/services')return json(res,200,{generated_at:new Date().toISOString(),services:listServices()},{'cache-control':'public, max-age=60'});
 if(req.method==='POST'&&req.url?.startsWith('/v1/services/')){try{const slug=decodeURIComponent(req.url.split('/').pop());return json(res,200,{service:slug,result:await executeService(slug,await readJson(req))},{'cache-control':'no-store'})}catch(e){return json(res,400,{error:e instanceof Error?e.message:String(e)})}}
 if(req.method==='GET'&&req.url==='/v1/revenue-lanes')return json(res,200,{generated_at:new Date().toISOString(),lanes:buildRevenueLanes({availableSources:[],credentialedExecutors:listExecutors().filter(x=>x.credentialed).map(x=>x.source)})},{'cache-control':'no-store'});
 if(req.method==='GET'&&req.url==='/v1/channels')return json(res,200,{generated_at:new Date().toISOString(),channels:revenueChannels(),portfolio:buildRevenuePortfolio()},{'cache-control':'public, max-age=120'});
 if(req.method==='GET'&&req.url==='/v1/income-engines')return json(res,200,{generated_at:new Date().toISOString(),engines:incomeEngines(),plan:buildIncomePlan()},{'cache-control':'no-store'});
 if(req.method==='GET'&&req.url==='/v1/autonomy-policy')return json(res,200,buildAutonomyPolicy(),{'cache-control':'no-store'});
 if(req.method==='GET'&&req.url==='/v1/development-status')return json(res,200,developmentStatus(),{'cache-control':'no-store'});
 if(req.method==='GET'&&req.url==='/v1/source-health')return json(res,200,{generated_at:new Date().toISOString(),sources:sourceHealth()},{'cache-control':'no-store'});
 if(req.method==='GET'&&req.url==='/v1/hourly-report')return json(res,200,hourlyReportStatus().last_report||await buildHourlyReport(),{'cache-control':'no-store'});
 if(req.method==='GET'&&req.url==='/v1/payouts')return json(res,200,await payoutOverview(),{'cache-control':'no-store'});
 if(req.method==='GET'&&req.url==='/v1/money-mode')return json(res,200,{enabled:String(process.env.MONEY_MODE??'true').toLowerCase()!=='false',wallet_configured:/^0x[a-f-f0-9]{40}$/i.test(process.env.TREASURY_BASE_ADDRESS||''),network:'base',asset:'USDC',private_key_required:false},{'cache-control':'no-store'});
 if(req.method==='GET'&&req.url==='/v1/payouts/registry')return json(res,200,{routes:payoutRegistry()},{'cache-control':'no-store'});
 if(req.method==='POST'&&req.url==='/v1/payouts/route'){try{const p=await readJson(req);return json(res,200,payoutRoute(p.source,p),{'cache-control':'no-store'})}catch(e){return json(res,400,{error:e instanceof Error?e.message:String(e)})}}
 if(req.method==='GET'&&req.url==='/v1/treasury')return json(res,200,await treasuryStatus(),{'cache-control':'no-store'});
 if(req.method==='GET'&&req.url==='/v1/treasury/policy')return json(res,200,treasuryPolicy(),{'cache-control':'no-store'});
 if(req.method==='GET'&&req.url==='/v1/zero-capital-plan'){try{const radar=await runRadar({...parseRadarQuery('/'),minReward:0});return json(res,200,buildZeroCapitalPlan(radar.opportunities||[]),{'cache-control':'no-store'})}catch(e){return json(res,502,{error:e instanceof Error?e.message:String(e)})}}
 if(req.method==='POST'&&req.url==='/v1/commerce-offers'){try{const p=await readJson(req);return json(res,200,buildCommerceOffers(p),{'cache-control':'no-store'})}catch(e){return json(res,400,{error:e instanceof Error?e.message:String(e)})}}
 if(req.method==='POST'&&req.url==='/v1/development-plan'){try{const p=await readJson(req);return json(res,200,await buildDevelopmentPlan(p),{'cache-control':'no-store'})}catch(e){return json(res,400,{error:e instanceof Error?e.message:String(e)})}}
 if(req.method==='POST'&&req.url==='/v1/development-cycle'){try{const p=await readJson(req);return json(res,200,await runDevelopmentCycle(p),{'cache-control':'no-store'})}catch(e){return json(res,400,{error:e instanceof Error?e.message:String(e)})}}
 if(req.method==='POST'&&req.url==='/v1/autonomy-decision'){try{const p=await readJson(req);return json(res,200,autonomyDecision(p.action,p))}catch(e){return json(res,400,{error:e instanceof Error?e.message:String(e)})}}
 if(req.method==='POST'&&req.url==='/v1/self-healing-plan'){try{const p=await readJson(req);return json(res,200,buildSelfHealingPlan(p),{'cache-control':'no-store'})}catch(e){return json(res,400,{error:e instanceof Error?e.message:String(e)})}}
 if(req.method==='GET'&&req.url==='/v1/strategy-state'){try{const radar=await runRadar(parseRadarQuery('/'));return json(res,200,await buildStrategyState(radar.opportunities||radar.strategy?.portfolio||[]),{'cache-control':'no-store'})}catch(e){return json(res,502,{error:e instanceof Error?e.message:String(e)})}}
 if(req.method==='GET'&&req.url==='/v1/market-radar'){try{return json(res,200,await scanMarkets({}),{'cache-control':'no-store'})}catch(e){return json(res,502,{error:e instanceof Error?e.message:String(e)})}}
 if(req.method==='POST'&&req.url==='/v1/capital-plan'){try{return json(res,200,buildCapitalPlan(await readJson(req)),{'cache-control':'no-store'})}catch(e){return json(res,400,{error:e instanceof Error?e.message:String(e)})}}
 if(req.method==='POST'&&req.url==='/v1/expansion-plan'){try{return json(res,200,buildExpansionPlan(await readJson(req)),{'cache-control':'no-store'})}catch(e){return json(res,400,{error:e instanceof Error?e.message:String(e)})}}
 if(req.method==='GET'&&req.url==='/v1/income-snapshot')return json(res,200,buildIncomeSnapshot({radarCount:0,queueCount:0}),{'cache-control':'no-store'});
 if(req.method==='GET'&&req.url==='/v1/apiforge/catalog')return json(res,200,{services:apiCatalog(),economics:apiEconomics(10000)},{'cache-control':'no-store'});
 if(req.method==='POST'&&req.url==='/v1/leadforge/score'){try{return json(res,200,buildLeadOffer(await readJson(req)))}catch(e){return json(res,400,{error:e instanceof Error?e.message:String(e)})}}
 if(req.method==='POST'&&req.url==='/v1/commissionforge/score'){try{return json(res,200,scoreCommission(await readJson(req)))}catch(e){return json(res,400,{error:e instanceof Error?e.message:String(e)})}}
 if(req.method==='GET'&&req.url==='/v1/revenue-plan')return json(res,200,{generated_at:new Date().toISOString(),lanes:revenueLanes(),plan:buildRevenuePlan()},{'cache-control':'public, max-age=120'});
  if(req.method==='POST'&&req.url==='/v1/execution/run'){const token=process.env.MEMORY_WRITE_TOKEN;if(!token||req.headers.authorization!==`Bearer ${token}`)return json(res,403,{error:'execution_disabled_or_unauthorized'});try{const p=await readJson(req);return json(res,200,{result:await executeOpportunity(p,{dryRun:false,action:p.action,external_link:p.external_link,result_text:p.result_text,transaction_id:p.transaction_id,content:p.content,claim_id:p.claim_id,artifact_refs:p.artifact_refs,receipt_ref:p.receipt_ref,summary:p.summary,pr_url:p.pr_url,issue_number:p.issue_number,pitch:p.pitch,submission_type:p.submission_type})})}catch(e){return json(res,400,{error:e instanceof Error?e.message:String(e)})}} 
 if(req.method==='GET'&&req.url==='/v1/executors')return json(res,200,{executors:listExecutors(),auto_hunter:typeof autoHunter.status==='function'?autoHunter.status():autoHunter},{'cache-control':'no-store'});
 if(req.method==='GET'&&req.url==='/v1/system-state'){try{const ledger=await readLedger();const q=executionQueue(ledger);return json(res,200,{generated_at:new Date().toISOString(),auto_hunter:typeof autoHunter.status==='function'?autoHunter.status():autoHunter,development:developmentStatus(),executors:listExecutors(),memory:await revenueMemorySummary(),queue:{count:q.length,items:q.slice(0,10)},channels:revenueChannels(),income_plan:buildIncomePlan()},{'cache-control':'no-store'})}catch(e){return json(res,500,{error:e instanceof Error?e.message:String(e)})}}
 if(req.method==='POST'&&req.url==='/v1/hunt'){const token=process.env.MEMORY_WRITE_TOKEN;if(!token||req.headers.authorization!==`Bearer ${token}`)return json(res,403,{error:'hunt_disabled_or_unauthorized'});try{return json(res,200,await huntOnce())}catch(e){return json(res,502,{error:e instanceof Error?e.message:String(e)})}}
 if(req.method==='POST'&&req.url==='/v1/execution/preview'){try{const p=await readJson(req);return json(res,200,await executeOpportunity({...p,policy:buildExecutionPlan([p])[0]?.policy},{dryRun:true}))}catch(e){return json(res,400,{error:e instanceof Error?e.message:String(e)})}}
 if(req.method==='GET'&&req.url==='/v1/execution-queue')return json(res,200,{queue:buildExecutionPlan(executionQueue(await readLedger()))},{'cache-control':'no-store'});
 if(req.method==='POST'&&req.url==='/v1/execution-queue'){const token=process.env.MEMORY_WRITE_TOKEN;if(!token||req.headers.authorization!==`Bearer ${token}`)return json(res,403,{error:'queue_write_disabled_or_unauthorized'});try{const p=await readJson(req);return json(res,201,{execution:await enqueueOpportunity(p)})}catch(e){return json(res,400,{error:e instanceof Error?e.message:String(e)})}}
 if(req.method==='PATCH'&&req.url?.startsWith('/v1/execution-queue/')){const token=process.env.MEMORY_WRITE_TOKEN;if(!token||req.headers.authorization!==`Bearer ${token}`)return json(res,403,{error:'queue_write_disabled_or_unauthorized'});try{const id=decodeURIComponent(req.url.split('/').pop());const p=await readJson(req);return json(res,200,{execution:await updateExecution(id,p)})}catch(e){return json(res,400,{error:e instanceof Error?e.message:String(e)})}}
 if(req.method==='GET'&&req.url==='/v1/revenue-memory')return json(res,200,await revenueMemorySummary(),{'cache-control':'no-store'});
 if(req.method==='POST'&&req.url==='/v1/revenue-memory/outcome'){const token=process.env.MEMORY_WRITE_TOKEN;if(!token||req.headers.authorization!==`Bearer ${token}`)return json(res,403,{error:'memory_write_disabled_or_unauthorized'});try{const p=await readJson(req);return json(res,200,{recorded:await recordOutcome(p)})}catch(e){return json(res,400,{error:e instanceof Error?e.message:String(e)})}}
 if(req.method==='GET'&&req.url==='/v1/offers')return json(res,200,{generated_at:new Date().toISOString(),offers:revenueOffers()},{'cache-control':'public, max-age=300'});
 if(req.method==='GET'&&req.url==='/metrics')return json(res,200,snapshotMetrics(),{'cache-control':'no-store'});
 if(req.method==='POST'&&req.url==='/v1/preflight'){const started=Date.now();try{const p=await readJson(req);if(!p.issue_url){observePreflight({ok:false,latencyMs:Date.now()-started});return json(res,400,{error:'issue_url is required'})}const r=await analyzeIssueUrl(p.issue_url);observePreflight({ok:true,latencyMs:Date.now()-started});return json(res,200,r)}catch(e){observePreflight({ok:false,latencyMs:Date.now()-started});return json(res,422,{error:e instanceof Error?e.message:String(e)})}}
 if(req.method==='POST'&&req.url==='/v1/payment-reliability'){try{const p=await readJson(req);if(!p.issue_url){observePaymentCheck({ok:false});return json(res,400,{error:'issue_url is required'})}const r=await analyzeIssueUrl(p.issue_url);observePaymentCheck({ok:true});return json(res,200,{source:r.source,reward:r.reward,payment:r.payment,recommendation:r.recommendation,red_flags:r.red_flags})}catch(e){observePaymentCheck({ok:false});return json(res,422,{error:e instanceof Error?e.message:String(e)})}}
 if(req.method==='GET'&&req.url?.startsWith('/v1/radar')){const started=Date.now();try{const params=parseRadarQuery(req.url);const r=await runRadar(params);observeRadar({ok:true,latencyMs:Date.now()-started});return json(res,200,{filters:params,...r})}catch(e){observeRadar({ok:false,latencyMs:Date.now()-started});return json(res,502,{error:e instanceof Error?e.message:String(e)})}}
 return json(res,404,{error:'not_found'})
});
server.listen(port,()=>console.error(`moneyhunter-preflight listening on http://localhost:${port}`));