export function canonicalOpportunityKey(source) {
  const url = String(source.issue_url || '').replace(/[#?].*$/, '').replace(/\/$/, '').toLowerCase();
  return [
    String(source.platform || '').trim().toLowerCase(),
    String(source.repository || '').trim().toLowerCase(),
    String(source.issue_number || '').trim(),
    url
  ].join('|');
}

export function dedupeOpportunities(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = canonicalOpportunityKey(item.source || item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
