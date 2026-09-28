import crypto from 'node:crypto';

const BASE='https://api.basedagents.ai';
const ALPHABET='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function b58(buf){
  let n=BigInt('0x'+Buffer.from(buf).toString('hex'));
  let out='';
  while(n>0n){const r=Number(n%58n);n/=58n;out=ALPHABET[r]+out;}
  let zeros=0; for(const b of buf){if(b!==0)break;zeros++;}
  return '1'.repeat(zeros)+(out||'1');
}
function privateKey(){
  const value=process.env.BASEDAGENTS_PRIVATE_KEY_PEM;
  return value ? crypto.createPrivateKey(value) : null;
}
function publicRaw(){
  const key=privateKey();
  return key ? crypto.createPublicKey(key).export({format:'der',type:'spki'}).subarray(-32) : null;
}
function leadingZeroBits(buf){
  let bits=0;
  for(const byte of buf){
    if(byte===0){bits+=8;continue;}
    for(let i=7;i>=0;i--){if((byte&(1<<i))===0)bits++;else return bits;}
  }
  return bits;
}
async function post(path,body){
  const res=await fetch(BASE+path,{method:'POST',headers:{accept:'application/json','content-type':'application/json','user-agent':'moneyhunter-preflight/1.0'},body:JSON.stringify(body)});
  const raw=await res.text();
  let json; try{json=raw?JSON.parse(raw):{};}catch{json={raw};}
  if(!res.ok)throw new Error(`BasedAgents HTTP ${res.status}: ${json?.error||json?.message||raw.slice(0,300)}`);
  return json;
}
async function get(path){
  const res=await fetch(BASE+path,{headers:{accept:'application/json','user-agent':'moneyhunter-preflight/1.0'}});
  if(res.status===404)return null;
  const raw=await res.text(); let json; try{json=raw?JSON.parse(raw):{};}catch{json={raw};}
  if(!res.ok)throw new Error(`BasedAgents HTTP ${res.status}: ${json?.error||json?.message||raw.slice(0,300)}`);
  return json;
}
function solvePow(pub,challenge,difficulty){
  const prefix=Buffer.concat([pub,Buffer.from(String(challenge))]);
  for(let nonce=0;nonce<=0xffffffff;nonce++){
    const n=Buffer.alloc(4);n.writeUInt32BE(nonce>>>0);
    if(leadingZeroBits(crypto.createHash('sha256').update(prefix).update(n).digest())>=difficulty)return n.toString('hex').padStart(8,'0');
  }
  throw new Error('BasedAgents proof-of-work exhausted');
}
export async function ensureBasedAgentsIdentity(){
  const key=privateKey();
  if(!key)return{status:'not_configured'};
  const pub=publicRaw();
  const pub58=b58(pub);
  const id=`ag_${pub58}`;
  try{
    const existing=await get(`/v1/agents/${encodeURIComponent(id)}`);
    if(existing)return{status:'registered',id};
    const init=await post('/v1/register/init',{public_key:pub58});
    const nonce=solvePow(pub,init.challenge,Number(init.difficulty||22));
    const signature=crypto.sign(null,Buffer.from(String(init.challenge)),key).toString('base64');
    const profile={
      name:process.env.BASEDAGENTS_AGENT_NAME||'MoneyHunter',
      description:process.env.BASEDAGENTS_AGENT_DESCRIPTION||'Autonomous software development, research, testing, and bounty agent.',
      capabilities:['software-development','research','testing','github','mcp'],
      protocols:['https','mcp']
    };
    const completed=await post('/v1/register/complete',{challenge_id:init.challenge_id,public_key:pub58,nonce,signature,profile,wallet_address:process.env.TREASURY_BASE_ADDRESS,wallet_network:'eip155:8453'});
    console.log(JSON.stringify({event:'basedagents_identity_ready',status:'registered',id:completed?.id||id}));
    return{status:'registered',id:completed?.id||id};
  }catch(error){
    const message=String(error);
    if(/BasedAgents HTTP 409:\s*conflict/i.test(message)){
      console.log(JSON.stringify({event:'basedagents_identity_ready',status:'already_registered',id}));
      return{status:'registered',id,already_registered:true};
    }
    console.error(JSON.stringify({event:'basedagents_identity_bootstrap_error',error:message}));
    return{status:'error',error:message};
  }
}
