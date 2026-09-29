import { treasuryStatus } from './treasury.js';

const TREASURY_BASE_ADDRESS = process.env.TREASURY_BASE_ADDRESS || '';
const BOUNTYBOOK_AGENT_ADDRESS = process.env.BOUNTYBOOK_AGENT_ADDRESS || '';

const SOURCE_DEFAULTS = {
  github: { payout_method:'base_usdc', network:'base', destination_type:'wallet', destination:TREASURY_BASE_ADDRESS, status: TREASURY_BASE_ADDRESS ? 'ready' : 'needs_destination', notes:'Use the public Base treasury address when the bounty/payment flow supports USDC on Base.' },
  basedagents: { payout_method:'base_usdc', network:'base', destination_type:'wallet', destination:TREASURY_BASE_ADDRESS, status: TREASURY_BASE_ADDRESS ? 'ready' : 'needs_destination' },
  basebounty: { payout_method:'base_usdc', network:'base', destination_type:'wallet', destination:TREASURY_BASE_ADDRESS, status: TREASURY_BASE_ADDRESS ? 'ready' : 'needs_destination' },
  frantic: { payout_method:'platform_configured', network:'source_defined', destination_type:'platform_account', destination:null, status:'needs_source_setup', notes:'Keep source-native payout configuration; never inject a private key.' },
  algora: { payout_method:'source_defined', network:'source_defined', destination_type:'platform_account', destination:null, status:'needs_source_verification' },
  opire: { payout_method:'direct_payment', network:'source_defined', destination_type:'counterparty', destination:null, status:'manual_payment_details', notes:'Payment is arranged directly by the bounty creator; do not assume automatic payout.' },
  clawlancer: { payout_method:'base_usdc', network:'base', destination_type:'agent_wallet', destination:null, status:'needs_agent_setup', notes:'Platform assigns an agent wallet on registration; payouts are USDC on Base. Do not assume the platform wallet is the treasury until withdrawal/configuration is verified.' },
  mya: { payout_method:'base_usdc', network:'base', destination_type:'wallet', destination:TREASURY_BASE_ADDRESS, status: TREASURY_BASE_ADDRESS ? 'ready' : 'needs_destination', notes:'Public API states earnings are paid in USDC on Base to the submitted wallet address.' },
  bountybook: { payout_method:'base_usdc', network:'base', destination_type:'agent_wallet', destination:BOUNTYBOOK_AGENT_ADDRESS || null, status: BOUNTYBOOK_AGENT_ADDRESS ? 'ready' : 'needs_agent_setup', notes:'Verified BountyBook earnings settle to the dedicated MoneyHunter agent wallet; no automatic outbound transfer is performed.' },
  taskbounty: { payout_method:'base_usdc', network:'base', destination_type:'platform_payout_account', destination:TREASURY_BASE_ADDRESS, status:'needs_source_setup', notes:'Current agent docs list USDC on Base as a payout rail; payout registration must be completed/verified before marking ready.' },
  gitlawbounty: { payout_method:'testnet_only', network:'base_sepolia', destination_type:'platform_wallet', destination:null, status:'not_cash_ready', notes:'Current public terminal is on Base Sepolia with a test token; do not count it as cash income.' },
};

export function payoutRegistry({ sources=[] }={}) {
  const names = sources.length ? sources : Object.keys(SOURCE_DEFAULTS);
  return names.map(source => ({ source, ...(SOURCE_DEFAULTS[source] || {
    payout_method:'unknown', network:'unknown', destination_type:'unknown',
    destination:null, status:'needs_verification'
  }) }));
}

export function payoutRoute(source, payout={}) {
  const key = String(source || '').toLowerCase();
  const configured = SOURCE_DEFAULTS[key];
  if (!configured) return { source:key, route:'manual_review', status:'needs_verification' };
  if (configured.status !== 'ready') return { source:key, route:'manual_review', ...configured };
  return { source:key, route:configured.destination_type==='agent_wallet'?'agent_wallet':'treasury', ...configured, asset:payout.asset || 'USDC' };
}

export async function payoutOverview() {
  const treasury = await treasuryStatus();
  return {
    generated_at:new Date().toISOString(),
    treasury,
    routes:payoutRegistry(),
    rules:{
      private_keys_required:false,
      automatic_outbound_transfers:false,
      auto_spend:false,
      only_public_destinations:true
    }
  };
}
