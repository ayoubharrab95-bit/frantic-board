import { treasuryStatus } from './treasury.js';

const TREASURY_BASE_ADDRESS = process.env.TREASURY_BASE_ADDRESS || '';

const SOURCE_DEFAULTS = {
  github: { payout_method:'base_usdc', network:'base', destination_type:'wallet', destination:TREASURY_BASE_ADDRESS, status: TREASURY_BASE_ADDRESS ? 'ready' : 'needs_destination', notes:'Use the public Base treasury address when the bounty/payment flow supports USDC on Base.' },
  basedagents: { payout_method:'base_usdc', network:'base', destination_type:'wallet', destination:TREASURY_BASE_ADDRESS, status: TREASURY_BASE_ADDRESS ? 'ready' : 'needs_destination' },
  basebounty: { payout_method:'base_usdc', network:'base', destination_type:'wallet', destination:TREASURY_BASE_ADDRESS, status: TREASURY_BASE_ADDRESS ? 'ready' : 'needs_destination' },
  frantic: { payout_method:'platform_configured', network:'source_defined', destination_type:'platform_account', destination:null, status:'needs_source_setup', notes:'Keep source-native payout configuration; never inject a private key.' },
  algora: { payout_method:'source_defined', network:'source_defined', destination_type:'platform_account', destination:null, status:'needs_source_verification' },
  opire: { payout_method:'direct_payment', network:'source_defined', destination_type:'counterparty', destination:null, status:'manual_payment_details', notes:'Payment is arranged directly by the bounty creator; do not assume automatic payout.' },
  clawlancer: { payout_method:'source_defined', network:'source_defined', destination_type:'platform_account', destination:null, status:'needs_source_verification' },
  mya: { payout_method:'source_defined', network:'source_defined', destination_type:'platform_account', destination:null, status:'needs_source_verification' },
  taskbounty: { payout_method:'source_defined', network:'source_defined', destination_type:'platform_account', destination:null, status:'needs_source_verification' },
  gitlawbounty: { payout_method:'source_defined', network:'source_defined', destination_type:'platform_account', destination:null, status:'needs_source_verification' }
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
  return { source:key, route:'treasury', ...configured, asset:payout.asset || 'USDC' };
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
