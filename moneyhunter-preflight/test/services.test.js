import test from 'node:test';
import assert from 'node:assert/strict';
import { listServices, executeService } from '../src/services.js';
test('service catalog exposes paid deterministic services',()=>{const s=listServices();assert.ok(s.some(x=>x.slug==='text-stats'));assert.ok(s.some(x=>x.slug==='json-normalize'));});
test('text stats is deterministic',async()=>{const r=await executeService('text-stats',{text:'hello world\nsecond.'});assert.equal(r.text_stats.words,3);assert.equal(r.text_stats.lines,2);});
test('json normalizer sorts object keys recursively',async()=>{const r=await executeService('json-normalize',{json:'{"b":1,"a":{"d":2,"c":3}}'});assert.deepEqual(r.normalized,{a:{c:3,d:2},b:1});});
