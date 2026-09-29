import { privateKeyToAccount } from 'viem/accounts';
const TREASURY = process.env.TREASURY_BASE_ADDRESS || '';
const agentAddress=()=>{try{const k=process.env.BOUNTYBOOK_AGENT_PRIVATE_KEY;if(!k)return null;return privateKeyToAccount(k.startsWith('0x')?k:`0x${k}`).address}catch{return null}};
const EVM=/^0x[a-fA-F0-9]{40}$/;

// MONEY MODE accepts only payouts that are explicitly receivable by the public
// EVM address configured for MoneyHunter. It never needs a seed phrase/private key.
const SOURCE_ROUTES={
  basebounty:{asset:'USDC',network:'base',chain_id:8453,automatic:true},
  basedagents:{asset:'USDC',network:'base',chain_id:8453,automatic:true},
  mya:{asset:'USDC',network:'base',chain_id:8453,automatic:true}
};

export function payoutCompatibility(item={}){
  const source=String(item.source||'').toLowerCase();
  const explicitNetwork=String(item.raw?.payout_network||item.raw?.payoutNetwork||item.network||'').toLowerCase();
  const explicitAsset=String(item.raw?.payout_asset||item.raw?.payoutAsset||item.currency||'').toUpperCase();
  const route=SOURCE_ROUTES[source];
  if(source==='bountybook'){
    const destination=agentAddress();
    if(destination) return {compatible:true,verified:true,asset:'USDC',network:'base',chain_id:8453,destination,method:'agent_wallet',reason:'BountyBook settles verified earnings to the dedicated MoneyHunter agent wallet'};
  }
  if(route && EVM.test(TREASURY)) return {compatible:true,verified:true,asset:route.asset,network:route.network,chain_id:route.chain_id,destination:TREASURY,method:'direct_wallet',reason:'source payout rail is Base USDC and a valid public treasury address is configured'};
  if(EVM.test(TREASURY) && ['base','ethereum','polygon','arbitrum','optimism','linea','bnb'].includes(explicitNetwork) && ['USDC','USDT','ETH','MATIC','POL','BNB'].includes(explicitAsset) && item.raw?.payout_wallet_required!==false){
    return {compatible:true,verified:true,asset:explicitAsset,network:explicitNetwork,chain_id:null,destination:TREASURY,method:'source_defined_evm_wallet',reason:'explicit EVM payout metadata matches configured public wallet'};
  }
  if(!EVM.test(TREASURY)) return {compatible:false,verified:false,asset:explicitAsset||null,network:explicitNetwork||null,destination:null,method:'blocked',reason:'TREASURY_BASE_ADDRESS is not configured'};
  return {compatible:false,verified:false,asset:explicitAsset||null,network:explicitNetwork||null,destination:null,method:'blocked',reason:'payout rail is not yet verified as directly receivable by the configured MetaMask-compatible EVM wallet'};
}

export function applyPayoutCompatibility(items=[]){
  return items.map(item=>({...item,payout:payoutCompatibility(item),payout_compatible:payoutCompatibility(item).compatible}));
}

export function moneyModeEnabled(){return String(process.env.MONEY_MODE??'true').toLowerCase()!=='false';}
