import express from 'express';
import { paymentMiddleware } from '@x402/express';
import { x402ResourceServer, HTTPFacilitatorClient } from '@x402/core/server';
import { ExactEvmScheme } from '@x402/evm/exact/server';

const isEvmAddress = (value) => /^0x[a-fA-F0-9]{40}$/.test(value || '');

function paymentRoutes({ NETWORK, PAY_TO, PRICE_PREFLIGHT, PRICE_RADAR, PRICE_PAYMENT_RELIABILITY }) {
  return {
    'POST /v1/preflight': {
      accepts: {
        scheme: 'exact',
        price: PRICE_PREFLIGHT,
        network: NETWORK,
        payTo: PAY_TO,
        maxTimeoutSeconds: 120
      },
      description: 'MoneyHunter bounty preflight'
    },
    'GET /v1/radar': {
      accepts: {
        scheme: 'exact',
        price: PRICE_RADAR,
        network: NETWORK,
        payTo: PAY_TO,
        maxTimeoutSeconds: 120
      },
      description: 'MoneyHunter paid opportunity radar'
    },
    'POST /v1/payment-reliability': {
      accepts: {
        scheme: 'exact',
        price: PRICE_PAYMENT_RELIABILITY,
        network: NETWORK,
        payTo: PAY_TO,
        maxTimeoutSeconds: 120
      },
      description: 'MoneyHunter payment reliability check'
    }
  };
}

function testPage() {
  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>MoneyHunter x402 Test</title>
<style>body{font-family:system-ui,sans-serif;max-width:760px;margin:40px auto;padding:0 20px;background:#0b0b0f;color:#f2f2f2}.card{background:#15151c;border:1px solid #2b2b38;border-radius:16px;padding:24px}button{font-size:16px;padding:14px 18px;border-radius:12px;border:0;cursor:pointer}pre{white-space:pre-wrap;word-break:break-word;background:#09090d;padding:14px;border-radius:10px;min-height:120px}</style>
</head><body><div class="card"><h1>MoneyHunter x402 Test</h1>
<p>One 0.10 test USDC payment on Base Sepolia. MetaMask signs locally; no private key is requested.</p>
<button id="go">Connect MetaMask & test payment</button><pre id="out">Ready.</pre></div>
<script>
const out=document.getElementById('out'),btn=document.getElementById('go');
const log=s=>out.textContent+='\\n'+s,set=s=>out.textContent=s;
const dec=v=>JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(v),c=>c.charCodeAt(0))));
const enc=v=>{const b=new TextEncoder().encode(JSON.stringify(v));let s='';for(const x of b)s+=String.fromCharCode(x);return btoa(s)};
const nonce=()=>{const b=new Uint8Array(32);crypto.getRandomValues(b);return '0x'+[...b].map(x=>x.toString(16).padStart(2,'0')).join('')};
async function chain(){const want='0x14a34';if((await ethereum.request({method:'eth_chainId'})).toLowerCase()===want)return;try{await ethereum.request({method:'wallet_switchEthereumChain',params:[{chainId:want}]})}catch(e){if(e?.code!==4902)throw e;await ethereum.request({method:'wallet_addEthereumChain',params:[{chainId:want,chainName:'Base Sepolia',nativeCurrency:{name:'ETH',symbol:'ETH',decimals:18},rpcUrls:['https://sepolia.base.org'],blockExplorerUrls:['https://sepolia.basescan.org']}]})}}
btn.onclick=async()=>{btn.disabled=true;try{
set('1/6 Checking MetaMask…');if(!window.ethereum)throw new Error('MetaMask not detected.');
const a=await ethereum.request({method:'eth_requestAccounts'}),from=a?.[0];if(!from)throw new Error('No account selected.');
log('2/6 Switching to Base Sepolia…');await chain();
log('3/6 Requesting x402 challenge…');const r1=await fetch('/v1/radar?min_reward=5&limit=1');if(r1.status!==402)throw new Error('Expected 402, got '+r1.status);
const h=r1.headers.get('PAYMENT-REQUIRED')||r1.headers.get('payment-required');if(!h)throw new Error('PAYMENT-REQUIRED missing.');
const req=dec(h),acc=(req.accepts||[]).find(x=>x.scheme==='exact'&&x.network==='eip155:84532');if(!acc)throw new Error('No Base Sepolia exact option.');
if(acc.payTo.toLowerCase()!=='0x8bdcc1064a9c373ea4f2746bd8713acf03cf19ab')throw new Error('Safety stop: unexpected recipient.');
if(acc.asset.toLowerCase()!=='0x036cbd53842c5426634e7929541ec2318f3dcf7e')throw new Error('Safety stop: unexpected token.');
if(BigInt(acc.amount)>100000n)throw new Error('Safety stop: amount exceeds 0.10 USDC.');
const now=Math.floor(Date.now()/1000),auth={from,to:acc.payTo,value:String(acc.amount),validAfter:String(now-60),validBefore:String(now+Math.max(60,Number(acc.maxTimeoutSeconds||60))),nonce:nonce()};
const typed={types:{EIP712Domain:[{name:'name',type:'string'},{name:'version',type:'string'},{name:'chainId',type:'uint256'},{name:'verifyingContract',type:'address'}],TransferWithAuthorization:[{name:'from',type:'address'},{name:'to',type:'address'},{name:'value',type:'uint256'},{name:'validAfter',type:'uint256'},{name:'validBefore',type:'uint256'},{name:'nonce',type:'bytes32'}]},domain:{name:acc.extra?.name||'USDC',version:acc.extra?.version||'2',chainId:84532,verifyingContract:acc.asset},primaryType:'TransferWithAuthorization',message:auth};
log('4/6 Approve the 0.10 TEST USDC signature in MetaMask…');const sig=await ethereum.request({method:'eth_signTypedData_v4',params:[from,JSON.stringify(typed)]});
const pay={x402Version:2,resource:req.resource,accepted:acc,payload:{signature:sig,authorization:auth},extensions:req.extensions||{}};
log('5/6 Settling…');const r2=await fetch('/v1/radar?min_reward=5&limit=1',{headers:{'PAYMENT-SIGNATURE':enc(pay)}}),txt=await r2.text();if(!r2.ok)throw new Error('Paid request failed '+r2.status+': '+txt);
log('6/6 SUCCESS ✅');const ph=r2.headers.get('PAYMENT-RESPONSE')||r2.headers.get('payment-response');if(ph){try{log('Settlement: '+JSON.stringify(dec(ph),null,2))}catch{log('Settlement receipt received.')}}log('API response: '+txt.slice(0,1500));
}catch(e){log('ERROR ❌ '+(e?.message||String(e)))}finally{btn.disabled=false}};
</script></body></html>`;
}

async function relay(response, res) {
  res.status(response.status);
  for (const [name, value] of response.headers.entries()) {
    const lower = name.toLowerCase();
    if (lower === 'content-length' || lower === 'content-encoding' || lower === 'transfer-encoding') continue;
    res.setHeader(name, value);
  }
  const body = Buffer.from(await response.arrayBuffer());
  res.send(body);
}

export function createApp(config = {}) {
  const NETWORK = config.NETWORK || process.env.NETWORK || 'eip155:84532';
  const ORIGIN_URL = config.ORIGIN_URL || process.env.ORIGIN_URL || 'https://moneyhunter-preflight.onrender.com';
  const PAY_TO = config.PAY_TO || process.env.PAY_TO || '';
  const PRICE_PREFLIGHT = config.PRICE_PREFLIGHT || process.env.PRICE_PREFLIGHT || '$0.05';
  const PRICE_RADAR = config.PRICE_RADAR || process.env.PRICE_RADAR || '$0.10';
  const PRICE_PAYMENT_RELIABILITY = config.PRICE_PAYMENT_RELIABILITY || process.env.PRICE_PAYMENT_RELIABILITY || '$0.03';

  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '64kb' }));

  app.get('/test-payment', (_req, res) => res.type('html').send(testPage()));

  app.get('/', (_req, res) => res.json({
    name: 'MoneyHunter x402 Gateway',
    version: '0.3.0',
    network: NETWORK,
    origin: ORIGIN_URL,
    prices: {
      preflight: PRICE_PREFLIGHT,
      radar: PRICE_RADAR,
      payment_reliability: PRICE_PAYMENT_RELIABILITY
    }
  }));

  app.get('/health', (_req, res) => res.json({
    ok: true,
    service: 'moneyhunter-x402-gateway',
    adapter: 'express',
    network: NETWORK,
    origin: ORIGIN_URL,
    pay_to_configured: isEvmAddress(PAY_TO)
  }));

  if (isEvmAddress(PAY_TO)) {
    const facilitator = new HTTPFacilitatorClient({ url: 'https://x402.org/facilitator' });
    const resourceServer = new x402ResourceServer(facilitator)
      .register('eip155:84532', new ExactEvmScheme())
      .register('eip155:8453', new ExactEvmScheme());

    app.use(paymentMiddleware(
      paymentRoutes({ NETWORK, PAY_TO, PRICE_PREFLIGHT, PRICE_RADAR, PRICE_PAYMENT_RELIABILITY }),
      resourceServer
    ));
  } else {
    app.use('/v1', (_req, res) => res.status(503).json({
      error: 'x402_not_configured',
      detail: 'PAY_TO must be a valid public EVM address.'
    }));
  }

  app.get('/v1/radar', async (req, res, next) => {
    try {
      const query = new URLSearchParams(req.query).toString();
      const upstream = await fetch(`${ORIGIN_URL}/v1/radar${query ? `?${query}` : ''}`);
      await relay(upstream, res);
    } catch (error) {
      next(error);
    }
  });

  app.post('/v1/preflight', async (req, res, next) => {
    try {
      const upstream = await fetch(`${ORIGIN_URL}/v1/preflight`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(req.body || {})
      });
      await relay(upstream, res);
    } catch (error) {
      next(error);
    }
  });

  app.post('/v1/payment-reliability', async (req, res, next) => {
    try {
      const upstream = await fetch(`${ORIGIN_URL}/v1/payment-reliability`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(req.body || {})
      });
      await relay(upstream, res);
    } catch (error) {
      next(error);
    }
  });

  app.use((error, _req, res, _next) => {
    console.error('gateway_error', error);
    res.status(500).json({
      error: 'gateway_internal_error',
      detail: error instanceof Error ? error.message : String(error)
    });
  });

  return app;
}

export { isEvmAddress };
