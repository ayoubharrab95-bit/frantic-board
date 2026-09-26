const CHANNELS=[
{id:'frantic',type:'bounty',status:'integrated',automation:'high',payment:'strong',repeatability:'medium',requires_spend:false,requires_auth:true,notes:'Agent-native funded bounties; claim window and payout ledger verification required.'},
{id:'github-paid',type:'bounty',status:'integrated',automation:'high',payment:'mixed',repeatability:'high',requires_spend:false,requires_auth:false,notes:'Public paid issues; canonical funding and AI-policy verification required.'},
{id:'algora',type:'bounty',status:'integrated',automation:'high',payment:'medium',repeatability:'high',requires_spend:false,requires_auth:false,notes:'Verify the canonical GitHub issue before acting.'},
{id:'opire',type:'bounty',status:'integrated',automation:'medium',payment:'mixed',repeatability:'high',requires_spend:false,requires_auth:false,notes:'Directory discovery only until the original task and funding are verified.'},
{id:'superteam',type:'bounty',status:'watch',automation:'medium',payment:'medium',repeatability:'medium',requires_spend:'sometimes',requires_auth:true,notes:'High-value crypto bounties; some competitions require trades or other user-funded actions, which are never auto-executed.'},
{id:'shipradar',type:'aggregator',status:'watch',automation:'medium',payment:'mixed',repeatability:'high',requires_spend:false,requires_auth:false,notes:'Use as a discovery layer, then verify the canonical source before execution.'},
{id:'direct-hire',type:'service',status:'ready',automation:'medium',payment:'manual',repeatability:'high',requires_spend:false,requires_auth:'varies',notes:'Sell packaged AI-assisted web, automation, API and integration work; external client communication/terms require human approval when consequential.'},
{id:'moneyhunter-api',type:'api',status:'live',automation:'high',payment:'x402',repeatability:'high',requires_spend:false,requires_auth:false,notes:'Machine-to-machine paid preflight, radar and payment-reliability tools on Base mainnet.'},
{id:'reusable-assets',type:'product',status:'planned',automation:'high',payment:'marketplace-dependent',repeatability:'very-high',requires_spend:false,requires_auth:'varies',notes:'Turn successful internal components into reusable templates, MCP tools and small developer utilities.'},
{id:'sponsorships-grants',type:'grant',status:'watch',automation:'low',payment:'mixed',repeatability:'low',requires_spend:false,requires_auth:'varies',notes:'Monitor legitimate open-source grants and agent-building programs; do not treat prize pools as guaranteed income.'}
];
const BLOCKED_PATTERNS=[
/private key/i,/seed phrase/i,/recovery phrase/i,/wallet signature/i,/pay gas/i,/buy .*usdc/i,/deposit/i,/kyc/i,/legal agreement/i
];
export function revenueChannels(){return CHANNELS.map(x=>({...x}));}
export function channelPolicy(channel){
 const text=JSON.stringify(channel);
 const blocked=BLOCKED_PATTERNS.some(re=>re.test(text));
 return {auto_allowed:!blocked&&channel.requires_spend===false&&channel.requires_auth!==true,requires_human_step:blocked||channel.requires_spend!==false||channel.requires_auth===true};
}
export function buildRevenuePortfolio({minAutomation='medium'}={}){
 const rank={very-high:5,high:4,medium:3,low:2};
 return CHANNELS.map(c=>({...c,policy:channelPolicy(c)}))
  .filter(c=>(rank[c.automation]??0)>=(rank[minAutomation]??3))
  .sort((a,b)=>(rank[b.automation]??0)-(rank[a.automation]??0)||Number(b.repeatability==='very-high')-Number(a.repeatability==='very-high'));
}
