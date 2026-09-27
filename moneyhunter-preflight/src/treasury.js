const TREASURY_BASE_ADDRESS = process.env.TREASURY_BASE_ADDRESS || '';

const BASE_RPC_URL = process.env.BASE_RPC_URL || 'https://mainnet.base.org';
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
