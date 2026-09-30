import { useEffect, useState } from 'react';
import { judgeApi } from '@/lib/judgeApi';
import { checkIsJudge } from '@/lib/judgeScoring';
import { useAuth } from '@/lib/AuthContext';

/**
 * True when the signed-in account can judge: it has an active judge profile
 * in this portal, or the 53 judging service recognises it as a judge.
 *
 * "Active" matters. This accepted any profile at all, so a judge whose access
 * had been revoked, or who had started onboarding and not finished, still saw
 * the judging workspace — and the server then refused every action in it,
 * because JudgeScoringController.activeJudge filters on exactly this status.
 * The navigation now agrees with the answer the server will give.
 *
 * A profile with no status at all is treated as active: the field is a later
 * addition and an older record should not lose access to a blank column.
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
      const status = String(profile?.status ?? '').toLowerCase();
      const activeProfile = !!profile && (status === '' || status === 'active');
      setIsJudge(!!local?.is_judge || activeProfile);
    });
    return () => { cancelled = true; };
  }, [isAuthenticated]);

  return isJudge;
}