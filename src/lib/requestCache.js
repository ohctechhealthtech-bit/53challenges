// Short-TTL cache with in-flight de-duplication, persisted for the session.
//
// Several components mount at once on the home page and the challenge
// catalogue, each asking for the same backend data. Without this, one page
// load fires the same function invoke two or three times over and trips the
// platform rate limit under rapid back-to-back navigation.
//
// It used to live only in memory, so every reload paid the whole waterfall:
// challenge list, then compliance statuses, then vote totals. The home page
// spent two seconds saying "Loading active challenges" before showing
// anything. Entries are now mirrored to sessionStorage and read back on load.
// A repeat visit renders the last result at once, and the fetch runs anyway
// in the background to replace it. A value past its TTL is still handed out
// immediately for the same reason: stale and present beats blank and loading.
//
// sessionStorage, not localStorage, on purpose. It is per tab and gone when
// the tab closes, and clearRequestCache() wipes it on sign-out. An admin's
// list includes inactive challenges nobody else should see, and it must not
// outlive their session or reach the next person at the same browser.

const PREFIX = 'rc:';
const cache = new Map();    // key -> { value, at }
const inFlight = new Map(); // key -> Promise

function storage() {
  try { return typeof window !== 'undefined' ? window.sessionStorage : null; } catch { return null; }
}

// Seed memory from storage once, so the first render of a repeat visit has data.
(() => {
  const s = storage();
  if (!s) return;
  try {
    for (let i = 0; i < s.length; i++) {
      const k = s.key(i);
      if (!k || !k.startsWith(PREFIX)) continue;
      const hit = JSON.parse(s.getItem(k));
      if (hit && typeof hit.at === 'number') cache.set(k.slice(PREFIX.length), hit);
    }
  } catch { /* unreadable storage: start empty */ }
})();

function persist(key, hit) {
  const s = storage();
  if (!s) return;
  try { s.setItem(PREFIX + key, JSON.stringify(hit)); } catch { /* quota or private mode */ }
}

function forget(key) {
  const s = storage();
  if (!s) return;
  try { s.removeItem(PREFIX + key); } catch { /* ignore */ }
}

/**
 * Run `fn` at most once per `key` per `ttlMs`. Concurrent callers with the
 * same key share the single in-flight promise.
 *
 * A fresh hit is returned as before. A stale hit is ALSO returned at once,
 * and `fn` runs in the background to replace it. The caller gets the last
 * known value instead of a loading state, and the next read is fresh.
 */
export async function cachedCall(key, ttlMs, fn) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.value;

  const pending = inFlight.get(key);
  if (pending) return hit ? hit.value : pending;

  const promise = (async () => {
    try {
      const value = await fn();
      const next = { value, at: Date.now() };
      cache.set(key, next);
      persist(key, next);
      return value;
    } finally {
      inFlight.delete(key);
    }
  })();
  inFlight.set(key, promise);

  // Stale value present: hand it back now, let the refresh land on its own.
  if (hit) { promise.catch(() => {}); return hit.value; }
  return promise;
}

/** Whether a (possibly stale) value is already held for `key`. */
export function hasCached(key) {
  return cache.has(key);
}

/** Drop cached entries whose key contains `substring` (or all when omitted). */
export function clearRequestCache(substring) {
  if (!substring) {
    for (const k of [...cache.keys()]) forget(k);
    cache.clear(); inFlight.clear();
    return;
  }
  for (const k of [...cache.keys()]) if (k.includes(substring)) { cache.delete(k); forget(k); }
}
