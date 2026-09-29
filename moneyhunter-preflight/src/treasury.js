const TREASURY_BASE_ADDRESS = process.env.TREASURY_BASE_ADDRESS || '';

const BASE_RPC_URL = process.env.BASE_RPC_URL || 'https://mainnet.base.org';
const BASE_CHAIN_ID = '0x2105';
const BASE_USDC = (process.env.BASE_USDC_CONTRACT || '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913').toLowerCase();

function validAddress(address) {
  return /^0x[a-fA-F0-9]{40}$/.test(String(address || ''));
}

function treasuryConfig() {
  const address = TREASURY_BASE_ADDRESS.trim();
  return {
    configured: validAddress(address),
    network: 'base',
    address: validAddress(address) ? address : null,
    usdc_contract: BASE_USDC,
    rpc_url: BASE_RPC_URL,
    custody: 'non_custodial'
  };
}

async function rpc(method, params) {
  const response = await fetch(BASE_RPC_URL, {
    method: 'POST',
    headers: {'content-type': 'application/json'},
    body: JSON.stringify({jsonrpc:'2.0',id:1,method,params})
  });
  if (!response.ok) throw new Error(`base_rpc_http_${response.status}`);
  const body = await response.json();
  if (body.error) throw new Error(body.error.message || 'base_rpc_error');
  return body.result;
}

function hexToBigInt(hex) {
  return BigInt(hex || '0x0');
}

function formatUnits(value, decimals=6) {
  const base = 10n ** BigInt(decimals);
  const whole = value / base;
  const fraction = (value % base).toString().padStart(decimals,'0').replace(/0+$/,'');
  return fraction ? `${whole}.${fraction}` : String(whole);
}

async function balanceOf(address, token) {
  const data = '0x70a08231' + address.slice(2).padStart(64,'0');
  return rpc('eth_call',[{to:token,data},'latest']);
}

export async function treasuryStatus() {
  const config = treasuryConfig();
  if (!config.configured) return { ...config, status:'unconfigured', balances:{base_native_eth:null,usdc:null} };
  try {
    const [nativeHex, usdcHex] = await Promise.all([
      rpc('eth_getBalance',[config.address,'latest']),
      balanceOf(config.address, config.usdc_contract)
    ]);
    return {
      ...config,
      status:'ready',
      balances:{
        base_native_eth: formatUnits(hexToBigInt(nativeHex),18),
        usdc: formatUnits(hexToBigInt(usdcHex),6)
      },
      checked_at:new Date().toISOString()
    };
  } catch (error) {
    return {...config,status:'configured_but_unreachable',balances:{base_native_eth:null,usdc:null},error:String(error.message||error),checked_at:new Date().toISOString()};
  }
}


const TRANSFER_TOPIC='0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a3b2b3c5d1';
function topicAddress(topic){return '0x'+String(topic||'').slice(-40).toLowerCase();}
function decodeTransferLog(log, treasury){
  if(String(log?.topics?.[0]||'').toLowerCase()!==TRANSFER_TOPIC)return null;
  if(!Array.isArray(log.topics)||log.topics.length<3)return null;
  return {
    token:String(log.address||'').toLowerCase(),
    from:topicAddress(log.topics[1]),
    to:topicAddress(log.topics[2]),
    amount_base_units:hexToBigInt(log.data||'0x0').toString(),
    amount_usdc:formatUnits(hexToBigInt(log.data||'0x0'),6),
    treasury_match:topicAddress(log.topics[2])===treasury.toLowerCase()
  };
}
export async function verifyUsdcPayment({tx_hash,expected_amount_usdc=0}={}){
  const tx=String(tx_hash||'').trim();
  const treasury=TREASURY_BASE_ADDRESS.trim();
  if(!/^0x[a-fA-F0-9]{64}$/.test(tx))return{verified:false,reason:'invalid_tx_hash'};
  if(!validAddress(treasury))return{verified:false,reason:'treasury_not_configured'};
  try{
    const chainId=await rpc('eth_chainId',[]);
    if(String(chainId).toLowerCase()!==BASE_CHAIN_ID)return{verified:false,reason:'wrong_network',tx_hash:tx,network:'base',chain_id:chainId};
    const receipt=await rpc('eth_getTransactionReceipt',[tx]);
    if(!receipt)return{verified:false,reason:'transaction_not_found',tx_hash:tx};
    if(String(receipt.status||'').toLowerCase()!=='0x1')return{verified:false,reason:'transaction_failed',tx_hash:tx};
    const transfers=(receipt.logs||[]).map(log=>decodeTransferLog(log,treasury)).filter(Boolean).filter(x=>x.token===BASE_USDC);
    const matching=transfers.filter(x=>x.treasury_match);
    const expected=Number(expected_amount_usdc)||0;
    const received=matching.reduce((sum,x)=>sum+Number(x.amount_usdc),0);
    return {
      verified:matching.length>0 && received >= expected,
      reason:matching.length===0?'no_usdc_transfer_to_treasury':received<expected?'received_amount_below_expected':'verified',
      tx_hash:tx,
      treasury,
      expected_amount_usdc:expected,
      received_amount_usdc:Number(received.toFixed(6)),
      transfers:matching,
      block_number:receipt.blockNumber||null,
      checked_at:new Date().toISOString()
    };
  }catch(error){return{verified:false,reason:'rpc_error',tx_hash:tx,error:String(error.message||error),checked_at:new Date().toISOString()};}
}

export function treasuryPolicy() {
  return {
    destination: TREASURY_BASE_ADDRESS || null,
    network:'base',
    assets:['USDC','ETH'],
    automatic_outbound_transfers:false,
    private_keys_required:false,
    notes:'Payouts remain controlled by each source. MoneyHunter only records expected/received payouts and reads the public treasury balance.'
  };
}
