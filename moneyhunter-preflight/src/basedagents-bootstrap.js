import crypto from 'node:crypto';

const BASE='https://api.basedagents.ai';
const ALPHABET='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function b58(buf){let n=BigInt('0x'+Buffer.from(buf).toString('hex'));let out='';while(n>0n){const r=Number(n%58n);n/=58n;out=ALPHABET[r]+out;}let zeros=0;for(const b of buf){if(b!==0)break;zeros++;}return'1'.repeat(zeros)+(out||'1');}
function privateKey(){const value=process.env.BASEDAGENTS_PRIVATE_KEY_PEM;return value?crypto.createPrivateKey(value):null;}
function publicRaw(){const key=privateKey();return key?crypto.createPublicKey(key).export({format:'der',type:'spki'}).subarray(-32):null;}
function leadingZeroBits(buf){let bits=0;for(const byte of buf){if(byte===0){bits+=8;continue;}for(let i=7;i>=0;i--){if((byte&(1<<i))===0)bits++;else return bits;}}return bits;}
function solvePow(pub,challenge,difficulty){const prefix=Buffer.concat([pub,Buffer.from(String(challenge))]);for(let nonce=0;nonce<=0xffffffff;nonce++){const n=Buffer.alloc(4);n.writeUInt32BE(nonce>>>0);if(leadingZeroBits(crypto.createHash('sha256').update(prefix).update(n).digest())>=difficulty)return n.toString('hex').padStart(8,'0');}throw new Error('BasedAgents proof-of-work exhausted');}
async function post(path,body){const res=await fetch(BASE+path,{method:'POST',headers:{accept:'application/json','content-type':'application/json','user-agent':'moneyhunter-preflight/1.0'},body:JSON.stringify(body)});const raw=await res.text();let json;try{json=raw?JSON.parse(raw):{};}catch{json={raw};}if(!res.ok)throw new Error(`BasedAgents HTTP ${res.status}: ${json?.error||json?.message||raw.slice(0,300)}`);return json;}
async function get(path){const res=await fetch(BASE+path,{headers:{accept:'application/json','user-agent':'moneyhunter-preflight/1.0'}});if(res.status===404)return null;const raw=await res.text();let json;try{json=raw?JSON.parse(raw):{};}catch{json={raw};}if(!res.ok)throw new Error(`BasedAgents HTTP ${res.status}: ${json?.error||json?.message||raw.slice(0,300)}`);return json;}
function agentSig(method,path,body=''){const key=privateKey(),pub=process.env.BASEDAGENTS_PUBLIC_KEY_B58;if(!key||!pub)return null;const timestamp=Math.floor(Date.now()/1000),nonce=crypto.randomUUID(),hash=crypto.createHash('sha256').update(body).digest('hex'),message=`${method}:${path}:${timestamp}:${hash}:${nonce}`,signature=crypto.sign(null,Buffer.from(message),key).toString('base64');return{authorization:`AgentSig ${pub}:${signature}`,timestamp:String(timestamp),nonce};}
async function signedPatch(path,body){const rawBody=JSON.stringify(body),auth=agentSig('PATCH',path,rawBody);if(!auth)throw new Error('agent_keypair_missing');const res=await fetch(BASE+path,{method:'PATCH',headers:{accept:'application/json','content-type':'application/json','user-agent':'moneyhunter-preflight/1.0',Authorization:auth.authorization,'X-Timestamp':auth.timestamp,'X-Nonce':auth.nonce},body:rawBody});const raw=await res.text();let json;try{json=raw?JSON.parse(raw):{};}catch{json={raw};}if(!res.ok)throw new Error(`BasedAgents HTTP ${res.status}: ${json?.error||json?.message||raw.slice(0,300)}`);return json;}

export async function ensureBasedAgentsIdentity(){
 const key=privateKey();if(!key)return{status:'not_configured'};const pub=publicRaw(),pub58=b58(pub),id=`ag_${pub58}`,wallet=process.env.TREASURY_BASE_ADDRESS;
 try{
  let existing=await get(`/v1/agents/${encodeURIComponent(id)}`);
  if(!existing){
   const init=await post('/v1/register/init',{public_key:pub58}),nonce=solvePow(pub,init.challenge,Number(init.difficulty||22)),signature=crypto.sign(null,Buffer.from(String(init.challenge)),key).toString('base64');
   const profile={name:process.env.BASEDAGENTS_AGENT_NAME||'MoneyHunter',description:process.env.BASEDAGENTS_AGENT_DESCRIPTION||'Autonomous software development, research, testing, data, and bounty agent.',capabilities:['software-development','research','testing','data','github','mcp','api-services'],protocols:['https','mcp'],version:'0.8.0',contact_endpoint:process.env.PUBLIC_BASE_URL||'https://moneyhunter-preflight.onrender.com'};
   existing=await post('/v1/register/complete',{challenge_id:init.challenge_id,public_key:pub58,nonce,signature,profile});
   console.log(JSON.stringify({event:'basedagents_identity_ready',status:'registered',id:existing?.id||id}));
  }else console.log(JSON.stringify({event:'basedagents_identity_ready',status:'already_registered',id}));
  if(wallet&&/^0x[a-fA-F0-9]{40}$/.test(wallet)){
   try{await signedPatch(`/v1/agents/${encodeURIComponent(id)}/wallet`,{wallet_address:wallet,wallet_network:'eip155:8453'});console.log(JSON.stringify({event:'basedagents_wallet_ready',status:'configured',network:'eip155:8453'}));}
   catch(error){console.error(JSON.stringify({event:'basedagents_wallet_error',error:String(error)}));}
  }
  return{status:'registered',id};
 }catch(error){
  const message=String(error);
  if(/BasedAgents HTTP 409:\s*conflict/i.test(message)){console.log(JSON.stringify({event:'basedagents_identity_ready',status:'already_registered',id});return{status:'registered',id,already_registered:true};}
  console.error(JSON.stringify({event:'basedagents_identity_bootstrap_error',error:message}));return{status:'error',error:message};
 }
}