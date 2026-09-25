import { useEffect, useState } from 'react';
import { hostRequests } from '@/lib/hostRequestsClient';
import { hostPortal } from '@/lib/hostPortalClient';
import { useAuth } from '@/lib/AuthContext';

/**
 * True when the signed-in account is a host: either they've sent a challenge
 * request, or they already have a host workspace from applying to host one.
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
      setIsHost((reqs?.requests || []).length > 0 || !!org?.has_organisation);
    });
    return () => { cancelled = true; };
  }, [isAuthenticated]);

  return isHost;
}