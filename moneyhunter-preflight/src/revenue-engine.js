const clamp=(n,min=0,max=1)=>Math.max(min,Math.min(max,Number(n)||0));

const LANES=[
 {id:'bounty-work',type:'active_work',model:'one_off',source:'radar',repeatability:'medium',automation:0.95,capital_required:0,expected_setup_minutes:0,notes:'Take only verified, AI-compatible, funded work.'},
 {id:'direct-services',type:'service',model:'one_off_or_repeat',source:'direct-hire',repeatability:'high',automation:0.65,capital_required:0,expected_setup_minutes:45,notes:'Package web, automation, API and integration work into fixed-scope offers.'},
 {id:'x402-api',type:'api',model:'usage_based',source:'moneyhunter-api',repeatability:'very_high',automation:0.98,capital_required:0,expected_setup_minutes:30,notes:'Machine-to-machine USDC revenue from paid endpoints.'},
 {id:'mcp-tools',type:'product',model:'usage_or_sale',source:'agent-marketplaces',repeatability:'very_high',automation:0.92,capital_required:0,expected_setup_minutes:90,notes:'Sell small MCP tools, skills and utilities repeatedly.'},
 {id:'templates',type:'product',model:'sale',source:'marketplaces',repeatability:'very_high',automation:0.9,capital_required:0,expected_setup_minutes:60,notes:'Turn validated internal components into reusable developer templates.'},
 {id:'affiliate-commission',type:'commission',model:'recurring',source:'agent-marketplaces',repeatability:'very_high',automation:0.75,capital_required:0,expected_setup_minutes:60,notes:'Only use legitimate referral programs; no spam, fake accounts or self-referrals.'},
 {id:'sponsorships-grants',type:'grant',model:'milestone',source:'open-source-programs',repeatability:'low',automation:0.35,capital_required:0,expected_setup_minutes:180,notes:'Treat grants/prizes as upside, never as guaranteed revenue.'},
 {id:'micro-bounties',type:'bounty',model:'one_off',source:'clawlancer|basedagents|basebounty|arcbounty',repeatability:'high',automation:0.8,capital_required:0,expected_setup_minutes:15,notes:'Discovery is automatic; wallet signing, bonds and gas remain human-gated.'}
];

export function revenueLanes(){return LANES.map(x=>({...x}));}

export function scoreRevenueLane(lane,signals={}){
 const demand=clamp(signals.demand??0.6),conversion=clamp(signals.conversion??0.35),repeat=lane.repeatability==='very_high'?1:lane.repeatability==='high'?.8:lane.repeatability==='medium'?.55:.3;
 const setup=Math.max(5,Number(lane.expected_setup_minutes)||5);
 const recurring=lane.model==='recurring'||lane.model==='usage_based'||lane.model==='sale';
 const raw=(demand*.4+conversion*.25+repeat*.35)*(lane.automation*.7+.3)/(setup/60);
 return {...lane,recurring,priority_score:Number(raw.toFixed(3))};
}

export function buildRevenuePlan({signals={}}={}){
 return LANES.map(l=>scoreRevenueLane(l,signals)).sort((a,b)=>b.priority_score-a.priority_score);
}
