import http from 'node:http';
import { analyzeIssueUrl } from './analyze.js';
import { runRadar } from './radar.js';
import { revenueChannels, buildRevenuePortfolio } from './channels.js';
import { revenueLanes, buildRevenuePlan } from './revenue-engine.js';
import { PRICING, PUBLIC_MANIFEST, LLMS_TEXT, OPENAPI } from './product.js';
import { revenueOffers } from './offers.js';
import { revenueMemorySummary, recordOutcome } from './revenue-memory.js';
import { observeRequest,observePreflight,observeRadar,observePaymentCheck,snapshotMetrics } from './observability.js';
const port=Number(process.env.PORT||8787);
const headers=t=>({'content-type':t,'access-control-allow-origin':'*','access-control-allow-headers':'content-type, authorization, payment-signature','access-control-allow-methods':'GET,POST,OPTIONS'});
const json=(res,status,body,extra={})=>{const e=JSON.stringify(body,null,2);res.writeHead(status,{...headers('application/json; charset=utf-8'),'content-length':Buffer.byteLength(e),...extra});res.end(e)};
const text=(res,status,body,t='text/plain; charset=utf-8')=>{res.writeHead(status,{...headers(t),'content-length':Buffer.byteLength(body)});res.end(body)};
async function readJson(req){let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>64000)throw new Error('Request body too large.')}return raw?JSON.parse(raw):{}}
function parseRadarQuery(s='/'){const u=new URL(s,'http://localhost'),minReward=Number(u.searchParams.get('min_reward')||5),limit=Number(u.searchParams.get('limit')||25),sources=(u.searchParams.get('sources')||'frantic,github,algora,opire,clawlancer,mya,basedagents,taskbounty').split(',').map(x=>x.trim()).filter(Boolean);return{minReward:Number.isFinite(minReward)?Math.max(0,minReward):5,limit:Number.isFinite(limit)?Math.min(100,Math.max(1,limit)):25,sources}}
const server=http.createServer(async(req,res)=>{
 observeRequest();
 if(req.method==='OPTIONS')return json(res,204,{});
 if(req.method==='GET'&&req.url==='/')return json(res,200,PUBLIC_MANIFEST);
 if(req.method==='GET'&&req.url==='/health')return json(res,200,{ok:true,service:'moneyhunter-preflight',version:PUBLIC_MANIFEST.version,features:PUBLIC_MANIFEST.features});
 if(req.method==='GET'&&req.url==='/llms.txt')return text(res,200,LLMS_TEXT);
 if(req.method==='GET'&&req.url==='/openapi.json')return json(res,200,OPENAPI);
 if(req.method==='GET'&&req.url==='/v1/pricing')return json(res,200,PRICING,{'cache-control':'public, max-age=300'});
 if(req.method==='GET'&&req.url==='/v1/channels')return json(res,200,{generated_at:new Date().toISOString(),channels:revenueChannels(),portfolio:buildRevenuePortfolio()},{'cache-control':'public, max-age=120'});
 if(req.method==='GET'&&req.url==='/v1/revenue-plan')return json(res,200,{generated_at:new Date().toISOString(),lanes:revenueLanes(),plan:buildRevenuePlan()},{'cache-control':'public, max-age=120'});
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