import test from 'node:test';
import assert from 'node:assert/strict';
import { canonicalOpportunityKey, dedupeOpportunities } from '../src/dedupe.js';

test('canonical key ignores URL query and fragment noise', () => {
  const a = canonicalOpportunityKey({
    platform: 'GitHub', repository: 'Owner/Repo', issue_number: 7,
    issue_url: 'https://github.com/Owner/Repo/issues/7?utm_source=x'
  });
  const b = canonicalOpportunityKey({
    platform: 'github', repository: 'owner/repo', issue_number: 7,
    issue_url: 'https://github.com/owner/repo/issues/7#top'
  });
  assert.equal(a, b);
});

test('dedupe removes mirror duplicates', () => {
  const source = {
    platform: 'github', repository: 'owner/repo', issue_number: 7,
    issue_url: 'https://github.com/owner/repo/issues/7'
  };
  assert.equal(dedupeOpportunities([{ source }, { source }]).length, 1);
});
