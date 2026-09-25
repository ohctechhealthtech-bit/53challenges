// Generic short-TTL cache with in-flight de-duplication.
//
// Several components mount at once on the home page and the challenge
// catalogue, each asking for the same backend data. Without this, one page
// load fires the same function invoke two or three times over and trips the
// platform rate limit under rapid back-to-back navigation.

const cache = new Map();    // key -> { value, at }
const inFlight = new Map(); // key -> Promise

/**
 * Run `fn` at most once per `key` per `ttlMs`. Concurrent callers with the
 * same key share the single in-flight promise.
 */
export async function cachedCall(key, ttlMs, fn) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.value;

  const pending = inFlight.get(key);
  if (pending) return pending;

  const promise = (async () => {
    try {
      const value = await fn();
      cache.set(key, { value, at: Date.now() });
      return value;
    } finally {
      inFlight.delete(key);
    }
  })();

  inFlight.set(key, promise);
  return promise;
}

/** Drop cached entries whose key contains `substring` (or all when omitted). */
export function clearRequestCache(substring) {
  if (!substring) { cache.clear(); inFlight.clear(); return; }
  for (const k of [...cache.keys()]) if (k.includes(substring)) cache.delete(k);
}