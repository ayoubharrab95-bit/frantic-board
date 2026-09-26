const adapters=new Map();

export function registerExecutor(source,executor){
  if(!source||!executor||typeof executor.execute!=='function')throw new Error('invalid_executor');
  adapters.set(source,executor);
}

export function executorStatus(source){
  const adapter=adapters.get(source);
  return adapter ? {source,available:true,credentialed:typeof adapter.ready==='function'?Boolean(adapter.ready()):true,actions:adapter.actions||['execute']} : {source,available:false,credentialed:false,actions:[]};
}

export function listExecutors(){
  return [...adapters.keys()].map(executorStatus);
}

export async function executeOpportunity(item,{dryRun=true}={}){
  const policy=item.policy||{};
  if(policy.action!=='api_execute')return {status:'blocked',reason:policy.reason||'policy_gate'};
  const adapter=adapters.get(item.source);
  if(!adapter)return {status:'prepare',reason:'no_executor_adapter',source:item.source};
  if(dryRun)return {status:'ready',source:item.source,actions:adapter.actions||['execute']};
  return adapter.execute(item);
}
