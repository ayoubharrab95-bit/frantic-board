import { analyzeIssueUrl } from './analyze.js';

export const SERVICE_CATALOG=[
  {slug:'github-issue-preflight',name:'GitHub Issue Preflight',price_usdc:'0.05',description:'Analyze a GitHub issue for reward, payment, AI policy, competition, clarity, and execution risks.'},
  {slug:'text-stats',name:'Text Statistics',price_usdc:'0.01',description:'Return deterministic character, word, line, sentence, and token-like whitespace statistics.'},
  {slug:'json-normalize',name:'JSON Normalizer',price_usdc:'0.01',description:'Validate JSON and return a recursively sorted, normalized representation.'}
];

function textStats(text=''){
 const value=String(text);
 const words=value.trim()?value.trim().split(/\s+/).length:0;
 const sentences=(value.match(/[.!?]+(?=\s|$)/g)||[]).length;
 return{characters:value.length,characters_no_spaces:value.replace(/\s/g,'').length,words,lines:value?value.split(/\r?\n/).length:0,sentences};
}
function sortJson(value){
 if(Array.isArray(value))return value.map(sortJson);
 if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(k=>[k,sortJson(value[k])]));
 return value;
}
export function listServices(){return SERVICE_CATALOG.map(x=>({...x}));}
export async function executeService(slug,input={}){
 if(slug==='text-stats')return{text_stats:textStats(input.text||'')};
 if(slug==='json-normalize'){
  const value=typeof input.json==='string'?JSON.parse(input.json):input.json;
  return{normalized:sortJson(value)};
 }
 if(slug==='github-issue-preflight'){
  if(!input.issue_url)throw new Error('issue_url is required');
  return await analyzeIssueUrl(String(input.issue_url));
 }
 throw new Error('unknown_service');
}
