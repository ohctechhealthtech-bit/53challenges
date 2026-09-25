import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';

// Challenges that have their own domain (e.g. photo.53challenges.com) should be
// reached there rather than at /challenges/<id> on the main site. This fetches
// the challenge_id -> full_domain map once per page load and shares it.

let cached = null;   // { [challenge_id]: full_domain }
let inFlight = null;

/** Fetches the map once; concurrent callers share the same promise. Never throws. */
export function fetchChallengeDomainMap() {
  if (cached) return Promise.resolve(cached);
  if (inFlight) return inFlight;

  inFlight = base44.functions
    .invoke('challengeDomains', { action: 'map' })
    .then((res) => res?.data?.map || {})
    // A missing or failing map must leave in-app links working, never break
    // the page — callers fall back to /challenges/<id>.
    .catch(() => ({}))
    .then((map) => {
      cached = map;
      inFlight = null;
      return map;
    });

  return inFlight;
}

/** The map, or {} until it arrives. */
export function useChallengeDomainMap() {
  const [map, setMap] = useState(cached || {});

  useEffect(() => {
    if (cached) return undefined;
    let cancelled = false;
    fetchChallengeDomainMap().then((m) => { if (!cancelled) setMap(m); });
    return () => { cancelled = true; };
  }, []);

  return map;
}

/**
 * Where a challenge should be opened from the page currently being viewed.
 * Returns { href } for a challenge hosted on another domain, or { to } for
 * normal in-app routing. Staying put when we are already on that host avoids a
 * pointless full-page reload.
 */
export function challengeTarget(challengeId, map) {
  const host = (map || {})[String(challengeId || '')];
  const here = typeof window === 'undefined' ? '' : window.location.hostname.toLowerCase();
  if (host && host !== here) return { href: `https://${host}/` };
  return { to: `/challenges/${challengeId}` };
}
