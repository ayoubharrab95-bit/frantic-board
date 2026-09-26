import test from 'node:test';
import assert from 'node:assert/strict';
import { revenueChannels, buildRevenuePortfolio, channelPolicy } from '../src/channels.js';
test('revenue portfolio includes multiple non-bounty channels',()=>{const c=revenueChannels();assert.ok(c.some(x=>x.type==='api'));assert.ok(c.some(x=>x.type==='service'));assert.ok(c.some(x=>x.type==='product'));});
test('moneyhunter API is automatically eligible while spending channels are gated',()=>{const api=candidate(revenueChannels(),'moneyhunter-api');assert.equal(channelPolicy(api).auto_allowed,true);const superteam=candidate(revenueChannels(),'superteam');assert.equal(channelPolicy(superteam).requires_human_step,true);});
test('portfolio remains diversified',()=>{const p=buildRevenuePortfolio();assert.ok(p.length>=5);assert.ok(new Set(p.map(x=>x.type)).size>=4);});
function candidate(rows,id){const x=rows.find(r=>r.id===id);assert.ok(x);return x;}
