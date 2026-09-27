const clamp=(n,min=0,max=1)=>Math.max(min,Math.min(max,Number(n)||0));
const ENGINE_DEFS=[
{id:'zero-capital-commerce',kind:'organic-commerce',automation:.92,repeatability:.95,capital:0,auth:'varies'},
{id:'bounty-hunter',kind:'work',automation:.95,repeatability:.55,capital:0,auth:true},
{id:'microservice-hunter',kind:'service',automation:.8,repeatability:.8,capital:0,auth:'varies'},
{id:'leadforge',kind:'direct-sales',automation:.7,repeatability:.85,capital:0,auth:'varies'},
{id:'apiforge',kind:'machine-sales',automation:.98,repeatability:1,capital:0,auth:false},
{id:'commissionforge',kind:'commission',automation:.75,repeatability:1,capital:0,auth:'varies'},
{id:'assetforge',kind:'digital-product',automation:.9,repeatability:1,capital:0,auth:'varies'},
{id:'bugbounty',kind:'security',automation:.65,repeatability:.65,capital:0,auth:true},
{id:'opportunity-miner',kind:'research',automation:.99,repeatability:1,capital:0,auth:false}
];
export function incomeEngines(){return ENGINE_DEFS.map(x=>({...x}));}
export function scoreEngine(engine,signals={}){const s=signals[engine.id]||signals;const demand=clamp(s.demand??.5),payout=clamp(s.payout??.4),competition=clamp(s.competition??.5),risk=clamp(s.risk??.2);const score=demand*.32+payout*.28+(1-competition)*.15+engine.repeatability*.2+engine.automation*.15-risk*.25;return {...engine,priority_score:Number(score.toFixed(4))};}
export function buildIncomePlan(signals={}){return ENGINE_DEFS.map(e=>scoreEngine(e,signals)).sort((a,b)=>b.priority_score-a.priority_score);}
export function buildIncomeSnapshot({radarCount=0,queueCount=0,signals={}}={}){return {version:'1.0',generated_at:new Date().toISOString(),radar:{opportunities:Number(radarCount)||0,queued:Number(queueCount)||0},engines:buildIncomePlan(signals),principles:['diversify demand','prefer repeatable revenue','avoid required spend','never bypass authorization','measure realized payouts']};}
