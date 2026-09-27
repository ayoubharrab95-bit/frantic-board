// Every external adapter must have an upper bound so one slow source cannot
// hold an API response or a paid x402 request open indefinitely.
export function boundedFetch(fetchImpl, url, options = {}, timeoutMs = 8000) {
  return fetchImpl(url, { ...options, signal: AbortSignal.timeout(timeoutMs) });
}
