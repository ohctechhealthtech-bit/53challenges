/** Entries waiting for this host's approval, for one challenge. */
import { useEffect, useState } from 'react';
import { Loader2, ShieldCheck } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { getSessionToken } from '@/lib/appSession';
import ContentApprovalCard from '@/components/moderation/ContentApprovalCard';

export default function ChallengePendingApproval({ challengeId, challengeTitle }) {
  const [entries, setEntries] = useState([]);
  const [canReview, setCanReview] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    base44.functions
      .invoke('moderateSubmission', { action: 'queue', challenge_id: challengeId, session_token: getSessionToken() })
      .then((res) => {
        if (!active) return;
        if (res.data?.error) { setError(res.data.error); return; }
        setEntries(res.data?.entries || []);
        setCanReview(!!res.data?.is_admin || !!res.data?.is_host);
      })
      .catch((e) => active && setError(e?.response?.data?.error || 'Could not load entries waiting for approval.'))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [challengeId]);

  if (loading) {
    return (
      <div className="mt-5 flex justify-center rounded-xl border border-border bg-secondary/30 py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!canReview && !entries.length) return null;

  return (
    <section className="mt-5 rounded-xl border border-border bg-secondary/30 p-4">
      <h4 className="flex items-center gap-2 font-heading text-base font-bold">
        <ShieldCheck className="h-5 w-5 text-primary" /> Pending your approval
        {entries.length > 0 && (
          <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-bold text-primary-foreground">{entries.length}</span>
        )}
      </h4>
      <p className="mt-1 text-sm text-muted-foreground">
        Entries to {challengeTitle} stay private until you approve them.
      </p>
      {error && <p className="mt-3 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
      {entries.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Nothing waiting for you right now.</p>
      ) : (
        <div className="mt-3 space-y-3">
          {entries.map((e) => (
            <ContentApprovalCard
              key={e.id}
              entry={e}
              onDecided={() => setEntries((list) => list.filter((x) => x.id !== e.id))}
            />
          ))}
        </div>
      )}
    </section>
  );
}