import { useCallback, useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { getSessionToken } from '@/lib/appSession';

/** The single source for every dashboard count and the waiting list. */
export default function useAdminInbox() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await base44.functions.invoke('adminInbox', { session_token: getSessionToken() });
      if (res.data?.error) {
        setError(res.data.error);
        setData({ queues: [], total: 0, waiting: [] });
      } else {
        setData(res.data);
      }
    } catch (e) {
      const status = e?.response?.status;
      setError(
        status === 401 || status === 403
          ? 'Your session has expired — please sign in again to load your queues.'
          : e?.response?.data?.error || e?.message || "Couldn't load your queues just now."
      );
      setData({ queues: [], total: 0, waiting: [] });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  return { inbox: data, loading, error, reload };
}