const fs = await import('node:fs/promises');
const path = await import('node:path');

const DATA_DIR = process.env.MONEYHUNTER_DATA_DIR || path.join(process.cwd(), 'data');
const LEDGER = path.join(DATA_DIR, 'revenue-ledger.json');
const SOURCE_PRIOR_FILE = path.join(DATA_DIR, 'source-priors.json');

const DEFAULT_PRIORS = {
  frantic:1, github:.82, algora:.90, opire:.55, clawlancer:.70, mya:.72, basedagents:.86, taskbounty:.88
};

async function readJson(file,fallback){
  try { return JSON.parse(await fs.readFile(file,'utf8')); }
  catch { return fallback; }
}
async function writeJson(file,value){
  await fs.mkdir(DATA_DIR,{recursive:true});
  const tmp=file+'.tmp';
  await fs.writeFile(tmp,JSON.stringify(value,null,2)+'\n','utf8');
  await fs.rename(tmp,file);
}
function normalizeStatus(status){return String(status||'unknown').toLowerCase().replace(/[^a-z_]/g,'_');}

export async function readLedger(){
  return readJson(LEDGER,[]);
}

export async function recordOutcome(outcome){
  const ledger=await readLedger();
  const row={
    id: outcome.id || `outcome-${Date.now()}`,
    source:String(outcome.source||'unknown'),
    opportunity_id:String(outcome.opportunity_id||outcome.id||''),
    reward_usd:Number(outcome.reward_usd||outcome.reward||0),
    effort_minutes:Math.max(0,Number(outcome.effort_minutes||0)),
    status:normalizeStatus(outcome.status),
    payout_usd:Math.max(0,Number(outcome.payout_usd||0)),
    accepted:Boolean(outcome.accepted),
    paid:Boolean(outcome.paid),
    ai_allowed:outcome.ai_allowed!==false,
    timestamp:outcome.timestamp||new Date().toISOString()
  };
  ledger.push(row);
  await writeJson(LEDGER,ledger.slice(-5000));
  await rebuildSourcePriors(ledger);
  return row;
}

export function summarizeLedger(ledger=[]){
  const bySource={};
  for(const row of ledger){
    const s=row.source;
    bySource[s] ||= {source:s,attempts:0,accepted:0,paid:0,payout_usd:0,effort_minutes:0,acceptance_rate:0,payment_rate:0,realized_hourly_usd:0};
    const x=bySource[s];
    x.attempts++; if(row.accepted)x.accepted++; if(row.paid)x.paid++;
    x.payout_usd+=Math.max(0,row.payout_usd||0); x.effort_minutes+=Math.max(0,row.effort_minutes||0);
  }
  for(const x of Object.values(bySource)){
    x.acceptance_rate=x.attempts?Number((x.accepted/x.attempts).toFixed(3)):0;
    x.payment_rate=x.attempts?Number((x.paid/x.attempts).toFixed(3)):0;
    x.realized_hourly_usd=x.effort_minutes?Number((x.payout_usd*60/x.effort_minutes).toFixed(2)):0;
  }
  return Object.values(bySource);
}

export async function rebuildSourcePriors(ledger=await readLedger()){
  const summaries=summarizeLedger(ledger), priors={...DEFAULT_PRIORS};
  for(const x of summaries){
    if(x.attempts<3) continue;
    const observed=.35*x.acceptance_rate+.35*x.payment_rate+.30*Math.min(1,x.realized_hourly_usd/50);
    priors[x.source]=Number(Math.max(.15,Math.min(1.25,.55*DEFAULT_PRIORS[x.source]+.45*observed)).toFixed(3));
  }
  await writeJson(SOURCE_PRIOR_FILE,priors);
  return priors;
}

export async function getSourcePriors(){
  return readJson(SOURCE_PRIOR_FILE,DEFAULT_PRIORS);
}

export async function revenueMemorySummary(){
  const ledger=await readLedger();
  return {entries:ledger.length,by_source:summarizeLedger(ledger),source_priors:await getSourcePriors(),last_updated:ledger.at(-1)?.timestamp||null};
}
