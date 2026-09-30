import { useEffect, useState } from 'react';
import { hostRequests } from '@/lib/hostRequestsClient';
import { hostPortal } from '@/lib/hostPortalClient';
import { useAuth } from '@/lib/AuthContext';

// Statuses that mean the application is over and the answer was no.
const DECIDED_AGAINST = new Set(['declined', 'rejected']);

/**
 * True when the signed-in account is a host: either they have a challenge
 * request still in play, or they already have a host workspace from applying
 * to host one. A declined or rejected request does not count.
 *
 * This is navigation, not permission â€” every host screen is enforced server
 * side. It should still tell the truth.
 */
export default function useIsHost() {
  const { isAuthenticated } = useAuth();
  const [isHost, setIsHost] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) { setIsHost(false); return; }
    let cancelled = false;
    Promise.all([
      hostRequests('my_requests').catch(() => null),
      hostPortal('get_organisation').catch(() => null),
    ]).then(([reqs, org]) => {
      if (cancelled) return;
      // A request that was declined or rejected is not a host. This counted
      // any request at all, so someone whose application was turned down kept
      // the host navigation — pointing at screens the server then refuses.
      // The UI should agree with the answer they were given.
      const live = (reqs?.requests || [])
        .filter((r) => !DECIDED_AGAINST.has(String(r?.status || '').toLowerCase()));
      setIsHost(live.length > 0 || !!org?.has_organisation);
    });
    return () => { cancelled = true; };
  }, [isAuthenticated]);

  return isHost;
}