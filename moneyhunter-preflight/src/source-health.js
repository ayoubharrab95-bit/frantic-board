const health = new Map();

const DEFAULT_COOLDOWNS = {
  auth_or_payment: 60 * 60 * 1000,
  rate_limit: 15 * 60 * 1000,
  server_error: 10 * 60 * 1000,
  network: 5 * 60 * 1000,
  empty: 0
};

function classify(sourceStatus={}) {
  const error = String(sourceStatus.error || '').toLowerCase();
  if (/\b402\b|payment|subscription|billing/.test(error)) return 'auth_or_payment';
  if (/\b401\b|\b403\b|credential|login|auth/.test(error)) return 'auth_or_payment';
  if (/\b429\b|rate.?limit/.test(error)) return 'rate_limit';
  if (/\b5\d\d\b|server error|bad gateway|service unavailable/.test(error)) return 'server_error';
  if (/timeout|network|econn|fetch failed/.test(error)) return 'network';
  return 'network';
}

export function observeSourceStatus(source, status, now=Date.now()) {
  if (!source) return null;
  const s = status || {};
  if (s.ok && Number(s.found || 0) > 0) {
    health.set(source, {
      source,
      state: 'healthy',
      failures: 0,
      last_ok_at: new Date(now).toISOString(),
      next_retry_at: null
    });
    return health.get(source);
  }
  if (s.ok && Number(s.found || 0) === 0) {
    const previous = health.get(source) || { failures: 0 };
    health.set(source, {
      source,
      state: 'empty',
      failures: previous.failures,
      last_empty_at: new Date(now).toISOString(),
      next_retry_at: null
    });
    return health.get(source);
  }

  const kind = classify(s);
  const previous = health.get(source) || { failures: 0 };
  const failures = Number(previous.failures || 0) + 1;
  const base = DEFAULT_COOLDOWNS[kind] || DEFAULT_COOLDOWNS.network;
  const multiplier = Math.min(4, Math.max(1, failures));
  const cooldown = Math.min(6 * 60 * 60 * 1000, base * multiplier);
  const next = now + cooldown;

  const row = {
    source,
    state: 'cooldown',
    failure_kind: kind,
    failures,
    last_error: String(s.error || 'source_failed'),
    last_failed_at: new Date(now).toISOString(),
    next_retry_at: new Date(next).toISOString()
  };
  health.set(source, row);
  return row;
}

export function filterAvailableSources(sources=[], now=Date.now()) {
  return sources.filter(source => {
    const row = health.get(source);
    if (!row || row.state !== 'cooldown') return true;
    const next = Date.parse(row.next_retry_at || '');
    return !Number.isFinite(next) || next <= now;
  });
}

export function sourceHealth(now=Date.now()) {
  return [...health.values()].map(row => ({
    ...row,
    cooling_down: row.state === 'cooldown' && Date.parse(row.next_retry_at || '') > now
  }));
}

export function clearSourceHealth(source) {
  if (source) health.delete(source);
  else health.clear();
}
