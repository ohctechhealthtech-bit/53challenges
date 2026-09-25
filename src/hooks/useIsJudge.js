import { useEffect, useState } from 'react';
import { judgeApi } from '@/lib/judgeApi';
import { checkIsJudge } from '@/lib/judgeScoring';
import { useAuth } from '@/lib/AuthContext';

/**
 * True when the signed-in account can judge: either it has a judge profile in
 * this portal, or the 53 judging service recognises it as a judge.
 */
export default function useIsJudge() {
  const { isAuthenticated } = useAuth();
  const [isJudge, setIsJudge] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) { setIsJudge(false); return; }
    let cancelled = false;
    Promise.all([
      checkIsJudge().catch(() => null),
      judgeApi('judge-profile').catch(() => null),
    ]).then(([local, remote]) => {
      if (cancelled) return;
      const profile = remote?.judge || remote?.profile || null;
      setIsJudge(!!local?.is_judge || !!profile);
    });
    return () => { cancelled = true; };
  }, [isAuthenticated]);

  return isJudge;
}