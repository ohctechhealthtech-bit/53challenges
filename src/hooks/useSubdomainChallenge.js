import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';

// Looks up the ChallengeDomain for the current host and loads the linked
// challenge. Returns { loading, domain, challenge, error }.
export function useSubdomainChallenge(slug) {
  const [state, setState] = useState({ loading: true, domain: null, challenge: null, error: '' });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!slug) {
        setState({ loading: false, domain: null, challenge: null, error: 'No subdomain specified' });
        return;
      }
      try {
        // Resolve through the public challengeDomains/resolve action rather
        // than reading ChallengeDomain from the browser. That entity's RLS read
        // rule is `user_condition: { role: 'admin' }`, which resolves against a
        // Base44 platform user — so a direct read returns an empty list (not an
        // error) for exactly the anonymous visitors these subdomains exist to
        // serve, and every subdomain would report 'not_found'.
        const host = typeof window === 'undefined' ? '' : window.location.hostname.toLowerCase();
        const res = await base44.functions.invoke('challengeDomains', { action: 'resolve', host });
        const data = res?.data || {};
        const challengeId = data.challenge_id || null;
        if (cancelled) return;
        if (!challengeId) {
          setState({ loading: false, domain: null, challenge: null, error: 'not_found' });
          return;
        }
        const domain = { slug, full_domain: host, challenge_id: challengeId, challenge_name: data.challenge_name || '' };

        // The challenge itself is deliberately NOT fetched here.
        //
        // SubdomainChallenge only reads `challenge.id`, which resolve already
        // returned, and ChallengeIntro then loads the challenge again from
        // scratch. Fetching it here cost two extra round trips on every
        // subdomain page load: a guaranteed 404 against the local Challenge
        // entity (these challenges live in the upstream API, not this
        // database) followed by the upstream call — both discarded. It also
        // tried the two sources in the opposite order to ChallengeIntro, so
        // the 404 was unavoidable rather than incidental.
        //
        // "Challenge not found" is still handled, by ChallengeIntro, which has
        // to handle it anyway for the /challenges/<id> route.
        if (cancelled) return;
        setState({ loading: false, domain, challenge: { id: challengeId }, error: '' });
      } catch (e) {
        if (!cancelled) setState({ loading: false, domain: null, challenge: null, error: e?.message || 'lookup_failed' });
      }
    })();
    return () => { cancelled = true; };
  }, [slug]);

  return state;
}
