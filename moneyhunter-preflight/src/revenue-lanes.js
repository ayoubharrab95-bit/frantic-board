export const REVENUE_LANES=[
  {id:'bounty_execution',name:'Bounty execution',mode:'earn_by_doing',targets:['bountybook','basebounty','basedagents','frantic','github','algora','opire','clawlancer'],payout:'USDC/Base'},
  {id:'agent_services',name:'Agent-to-agent services',mode:'earn_by_serving',targets:['agent-bazaar','the402','agentic.market','agoragentic','other_x402_marketplaces'],payout:'USDC/Base'},
  {id:'research_data',name:'Research and data work',mode:'earn_by_doing',targets:['bountybook','basedagents','github'],capabilities:['research','web_data','normalization','structured_json'],payout:'USDC/Base'},
  {id:'software_delivery',name:'Software delivery',mode:'earn_by_doing',targets:['bountybook','basedagents','basebounty','github'],capabilities:['bugfix','tests','scripts','docs','api_integration'],payout:'USDC/Base'},
  {id:'micro_services',name:'Micro-services',mode:'earn_by_serving',targets:['agoragentic'],capabilities:['url_fetch','github_preflight','text_transform','json_transform'],payout:'USDC/Base'}
];

export function revenueLanes(){return REVENUE_LANES.map(x=>({...x}));}
export function buildRevenueLanes({availableSources=[],credentialedExecutors=[]}={}){
  const sourceSet=new Set(availableSources);
  return REVENUE_LANES.map(lane=>({
    ...lane,
    available_targets:lane.targets.filter(x=>sourceSet.has(x)||lane.mode==='earn_by_serving'&&x==='agoragentic'),
    executor_ready:lane.targets.some(x=>credentialedExecutors.includes(x)),
    priority:lane.id==='bounty_execution'?100:lane.id==='software_delivery'?90:lane.id==='research_data'?80:lane.id==='micro_services'?70:60
  })).sort((a,b)=>b.priority-a.priority);
}
