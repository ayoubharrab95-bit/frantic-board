import { readLedger, revenueMemorySummary } from './revenue-memory.js';

let lastReport=null;
let timer=null;

function money(ledger, predicate){
  return ledger.filter(predicate).reduce((n,r)=>n+Math.max(0,Number(r.payout_usd||r.reward_usd||0)),0);
}

export async function buildHourlyReport(extra={}){
  const ledger=await readLedger();
  const since=Date.now()-60*60*1000;
  const recent=ledger.filter(r=>Date.parse(r.updated_at||r.timestamp||r.created_at||0)>=since);
  const report={
    generated_at:new Date().toISOString(),
    window:'previous_60_minutes',
    scans:Number(extra.scans||0),
    sources_scanned:Number(extra.sources_scanned||0),
    opportunities_found:Number(extra.opportunities_found||0),
    started:recent.filter(r=>['attempted','running','claimed','in_progress'].includes(r.status)).length,
    completed:recent.filter(r=>['completed','submitted','approved','paid'].includes(r.status)).length,
    paid:recent.filter(r=>r.paid===true||r.status==='paid').length,
    gross_confirmed_usd:money(recent,r=>r.paid===true||r.status==='paid'),
    pending_usd:money(recent,r=>['submitted','approved','claimed','attempted'].includes(r.status)&&!r.paid),
    entries_in_ledger:ledger.length,
    source_memory:(await revenueMemorySummary()).by_source,
    notes:['Confirmed income is based only on recorded paid outcomes; pending/expected values are not counted as earnings.']
  };
  lastReport=report;
  return report;
}

export function startHourlyReport(getStats=()=>({})){
  if(timer) return {enabled:true};
  timer=setInterval(
    ()=>buildHourlyReport(getStats())
      .then(r=>console.log(JSON.stringify({event:'moneyhunter_hourly_report',report:r})))
      .catch(e=>console.error(JSON.stringify({event:'hourly_report_error',error:String(e)}))),
    60*60*1000
  );
  return {enabled:true};
}

export function hourlyReportStatus(){return{last_report:lastReport,enabled:Boolean(timer)}}
