/**
 * Loads the signed-in host's organisation once, so the wizard knows whether it
 * still needs to ask for organisation details.
 */
import { useCallback, useEffect, useState } from 'react';
import { hostPortal } from '@/lib/hostPortalClient';

export default function useHostOrganisation() {
  const [organisation, setOrganisation] = useState(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const res = await hostPortal('get_organisation').catch(() => null);
    setOrganisation(res?.has_organisation ? res.organisation : null);
    setLoading(false);
  }, []);

  useEffect(() => { reload(); }, [reload]);

  return { organisation, loading, reload };
}