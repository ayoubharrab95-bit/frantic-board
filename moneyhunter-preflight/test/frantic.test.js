import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseFranticIndex,
  parseFranticBountyPage
} from '../src/sources/frantic.js';

test('extracts unique Frantic bounty ids', () => {
  const html = '<a href="/bounties/135">A</a><a href="/bounties/135">A2</a><a href="/bounties/97">B</a>';
  assert.deepEqual(parseFranticIndex(html), ['135', '97']);
});

test('parses an open funded-looking Frantic bounty page', () => {
  const html = `
    <h1>#135 Run an Agent Inbox end to end</h1>
    <p>This paid bounty is $10 or less.</p><span>$3 FUNDED</span>
    <strong>CLAIM GATE OPEN</strong>
    <div>available 4/10</div>
    <div>active 1</div>
  `;
  const result = parseFranticBountyPage('135', html);
  assert.equal(result.id, '135');
  assert.equal(result.source, 'frantic');
  assert.equal(result.status, 'open');
  assert.equal(result.reward, 3);
  assert.equal(result.available_slots, 4);
  assert.equal(result.active_claims, 1);
});
