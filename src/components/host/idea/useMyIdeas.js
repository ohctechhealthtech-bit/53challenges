/** Ideas already submitted by the signed-in host, matched on their account email. */
import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';

export default function useMyIdeas() {
  const [ideas, setIdeas] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await base44.functions.invoke('hostChallengeRequest', { action: 'my_ideas' });
        if (alive) setIdeas(res.data?.ideas || []);
      } catch {
        if (alive) setIdeas([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  return { ideas, loading };
}