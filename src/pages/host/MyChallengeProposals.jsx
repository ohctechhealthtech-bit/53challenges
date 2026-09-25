/**
 * D8 — Host Experience Principles.
 * Rules applied: D8.3 (calm status, no blockers), D8.4 (host status vocabulary only),
 * D8.6 (internal routing never shown).
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Loader2, Plus, ArrowRight } from 'lucide-react';
import { getHostStatusLabel, HOST_TONE_STYLES } from '@/lib/hostStatusLabels';

export default function MyChallengeProposals() {
  const [proposals, setProposals] = useState([]);
  const [loading, setLoading] = useState(true);

  const [justPaid, setJustPaid] = useState(false);

  useEffect(() => {
    (async () => {
      const params = new URLSearchParams(window.location.search);
      if (params.get('paid') === '1' && params.get('draft')) {
        try {
          const payload = JSON.parse(decodeURIComponent(atob(params.get('draft'))));
          await base44.functions.invoke('hostPortal', { action: 'submit_proposal', proposal: payload });
          setJustPaid(true);
        } catch { /* already created or unreadable — fall through to the list */ }
        window.history.replaceState({}, '', '/my-challenge-proposals');
      }
      const res = await base44.functions.invoke('hostPortal', { action: 'list_my_proposals' }).catch(() => null);
      setProposals(res?.data?.proposals || []);
      setLoading(false);
    })();
  }, []);

  return (
    <main className="container-tight py-10 sm:py-14">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-extrabold sm:text-4xl">My challenges</h1>
          <p className="mt-2 text-sm text-muted-foreground">Track how each of your challenges is going.</p>
        </div>
        <Button asChild className="grad-bg border-0">
          <Link to="/host-apply"><Plus className="mr-1 h-4 w-4" /> Start a new challenge</Link>
        </Button>
      </div>

      {justPaid && (
        <div className="mb-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-300">
          Thanks — your deposit is paid and your proposal is with our team. We'll be in touch shortly.
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : proposals.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">
            You haven't started a challenge yet. It only takes a few minutes.
          </p>
          <Button asChild className="mt-4 grad-bg border-0">
            <Link to="/host-apply">Host a challenge</Link>
          </Button>
        </div>
      ) : (
        <ul className="space-y-3">
          {proposals.map((p) => {
            const status = getHostStatusLabel(p.review_status, {
              note: p.admin_feedback,
              reason: p.decline_reason,
            });
            const styles = HOST_TONE_STYLES[status.tone];
            return (
              <li key={p.id}>
                <Link
                  to={`/host-workspace/${p.id}`}
                  className="flex flex-wrap items-center gap-4 rounded-2xl border border-border bg-card p-5 transition-colors hover:border-primary/40"
                >
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate font-heading text-lg font-bold">{p.challenge_title || 'Untitled challenge'}</h2>
                    <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">{status.detail}</p>
                  </div>
                  <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${styles.badge}`}>
                    {status.label}
                  </span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}