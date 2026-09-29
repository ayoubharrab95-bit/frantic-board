import { executeService, listServices } from './services.js';
import { verifyUsdcPayment } from './treasury.js';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

const DATA_DIR = process.env.MONEYHUNTER_DATA_DIR || path.join(process.cwd(),'data');
const JOBS_FILE = path.join(DATA_DIR,'paid-jobs.json');
const MAX_INPUT_BYTES = 50000;

async function readJobs(){
  try { return JSON.parse(await fs.readFile(JOBS_FILE,'utf8')); }
  catch { return []; }
}
async function writeJobs(jobs){
  await fs.mkdir(DATA_DIR,{recursive:true});
  const tmp=JOBS_FILE+'.tmp';
  await fs.writeFile(tmp,JSON.stringify(jobs.slice(-2000),null,2)+'\n','utf8');
  await fs.rename(tmp,JOBS_FILE);
}
function idFor(txHash,slug){
  return 'job_'+createHash('sha256').update(String(txHash).toLowerCase()+'|'+slug).digest('hex').slice(0,24);
}
function publicJob(job){
  const {input,...safe}=job;
  return safe;
}
function service(slug){ return listServices().find(x=>x.slug===slug); }

export async function createPaidJob({service_slug,tx_hash,input={},idempotency_key}={}){
  const slug=String(service_slug||'').trim();
  const item=service(slug);
  if(!item) throw new Error('unknown_service');
  if(!/^0x[a-fA-F0-9]{64}$/.test(String(tx_hash||''))) throw new Error('tx_hash_required');
  const raw=JSON.stringify(input||{});
  if(Buffer.byteLength(raw,'utf8')>MAX_INPUT_BYTES) throw new Error('input_too_large');

  const jobs=await readJobs();
  const existing=jobs.find(x=>x.tx_hash.toLowerCase()===String(tx_hash).toLowerCase());
  if(existing) return {job:publicJob(existing),idempotent:true};

  const payment=await verifyUsdcPayment({tx_hash,expected_amount_usdc:Number(item.price_usdc)});
  if(!payment.verified) return {job:null,payment,status:'payment_rejected'};

  const now=new Date().toISOString();
  const job={
    id:idFor(tx_hash,slug), service_slug:slug, tx_hash:String(tx_hash),
    idempotency_key:String(idempotency_key||''), input:input||{},
    price_usdc:item.price_usdc, status:'paid', created_at:now, updated_at:now,
    payment:{verified:true,received_amount_usdc:payment.received_amount_usdc,block_number:payment.block_number}
  };
  jobs.push(job);
  await writeJobs(jobs);
  try{
    job.status='executing'; job.updated_at=new Date().toISOString(); await writeJobs(jobs);
    const result=await executeService(slug,input||{});
    job.status='completed'; job.result=result; job.updated_at=new Date().toISOString();
    await writeJobs(jobs);
    return {job:publicJob(job),result};
  }catch(error){
    job.status='failed'; job.error=String(error?.message||error); job.updated_at=new Date().toISOString();
    await writeJobs(jobs);
    return {job:publicJob(job)};
  }
}

export async function paidJobStatus(id){
  const jobs=await readJobs();
  const job=jobs.find(x=>x.id===String(id));
  if(!job) return null;
  return publicJob(job);
}
export function paidJobCatalog(){ return listServices().map(x=>({...x,payment:{asset:'USDC',network:'Base',network_id:'eip155:8453'}})); }
