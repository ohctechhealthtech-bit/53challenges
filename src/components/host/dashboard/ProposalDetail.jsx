/**
 * One application in detail: status tracker, review track, and its invoices.
 */
import { useEffect, useState } from 'react';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { hostPortal } from '@/lib/hostPortalClient';
import ProposalStatusTracker from '@/components/host/dashboard/ProposalStatusTracker';
import ChallengeLiveStatus from '@/components/host/dashboard/ChallengeLiveStatus';
import ChallengePendingApproval from '@/components/host/dashboard/ChallengePendingApproval';
import { InvoiceStatusBadge } from '@/components/host/dashboard/InvoicesPanel';
import { formatAud } from '@/lib/hostDeposit';

const QUEUE_LABELS = {
  standard: 'Standard review',
  coordinator: 'Coordinator review',
  senior: 'Senior review',
  compliance: 'Safety & compliance review',
};

export default function ProposalDetail({ proposalId, onBack }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setData(null);
    hostPortal('get_proposal', { id: proposalId })
      .then((d) => { if (active) setData(d); })
      .catch((e) => { if (active) setError(e?.message || 'Could not load this application'); });
    return () => { active = false; };
  }, [proposalId]);

  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!data) {
    return (
      <div className="flex items-center justify-center rounded-2xl border border-border bg-card py-12">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }

  const { proposal, invoices, payment_status, route_queue, live_challenge } = data;

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <Button variant="ghost" size="sm" onClick={onBack} className="mb-3 -ml-2 h-7 text-xs">
        <ArrowLeft className="mr-1 h-3.5 w-3.5" /> All challenges
      </Button>
      <h3 className="font-heading text-xl font-extrabold">{proposal.challenge_title || 'Untitled challenge'}</h3>
      {proposal.challenge_description && (
        <p className="mt-1 text-sm text-muted-foreground">{proposal.challenge_description}</p>
      )}

      {/* Once the challenge is live on 53 Challenges, its real status replaces
          the application review tracker. */}
      {live_challenge ? (
        <ChallengeLiveStatus challenge={live_challenge} />
      ) : (
        <div className="mt-5">
          <ProposalStatusTracker reviewStatus={proposal.review_status} />
        </div>
      )}

      {live_challenge && (
        <ChallengePendingApproval challengeId={live_challenge.id} challengeTitle={live_challenge.title} />
      )}

      {proposal.admin_feedback && proposal.review_status === 'changes_requested' && (
        <div className="mt-4 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-300">Our team asked for changes</p>
          <p className="mt-1 text-sm">{proposal.admin_feedback}</p>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2 text-xs">
        <span className="rounded-full border border-border px-2.5 py-1 text-muted-foreground">
          {QUEUE_LABELS[route_queue] || 'Standard review'}
        </span>
        <span className={`rounded-full px-2.5 py-1 font-semibold ${
          payment_status === 'paid' ? 'bg-emerald-500/15 text-emerald-300'
          : payment_status === 'pending' ? 'bg-amber-500/15 text-amber-300'
          : 'border border-border text-muted-foreground'
        }`}>
          {payment_status === 'paid' ? 'Payment received' : payment_status === 'pending' ? 'Payment pending' : 'No payment needed'}
        </span>
      </div>

      {invoices.length > 0 && (
        <div className="mt-5">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Invoices for this challenge</p>
          <ul className="divide-y divide-border">
            {invoices.map((inv) => (
              <li key={inv.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="min-w-0 truncate">{inv.label || 'Invoice'}</span>
                <span className="flex shrink-0 items-center gap-2">
                  <span className="font-bold">{formatAud((inv.amount || 0) / 100)}</span>
                  <InvoiceStatusBadge status={inv.status} />
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}