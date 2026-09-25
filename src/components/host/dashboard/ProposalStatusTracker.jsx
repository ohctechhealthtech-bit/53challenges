/**
 * Apply → Review → Agreement → Approval → Go Live tracker for a proposal.
 */
import { Check, XCircle } from 'lucide-react';
import { HOST_JOURNEY_STEPS as STAGES } from '@/components/host/journeySteps';

export function stageIndex(reviewStatus) {
  switch (reviewStatus) {
    case 'intake_received':
    case 'builder_started': return 0;
    case 'submitted_for_review':
    case 'in_review':
    case 'changes_requested': return 1;
    case 'terms_pending': return 2;
    case 'approved':
    case 'approved_and_signed': return 3;
    case 'live': return 4;
    default: return 0;
  }
}

export default function ProposalStatusTracker({ reviewStatus }) {
  if (reviewStatus === 'rejected') {
    return (
      <p className="flex items-center gap-2 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
        <XCircle className="h-4 w-4" /> This application was declined.
      </p>
    );
  }
  const current = stageIndex(reviewStatus);
  return (
    <ol className="flex items-center gap-1 sm:gap-2">
      {STAGES.map((label, i) => {
        const isDone = i < current || (i === current && reviewStatus === 'live');
        const isActive = i === current && reviewStatus !== 'live';
        return (
          <li key={label} className="flex flex-1 items-center gap-1 sm:gap-2">
            <div className="flex min-w-0 flex-col items-center gap-1.5 text-center">
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  isDone
                    ? 'border border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
                    : isActive
                    ? 'grad-bg text-white'
                    : 'border border-border bg-muted text-muted-foreground'
                }`}
                aria-hidden="true"
              >
                {isDone ? <Check className="h-4 w-4" /> : i + 1}
              </span>
              <span className={`text-[10px] font-semibold sm:text-xs ${isActive ? 'text-foreground' : isDone ? 'text-emerald-300' : 'text-muted-foreground'}`}>
                {label}
              </span>
            </div>
            {i < STAGES.length - 1 && (
              <span className={`h-px flex-1 ${isDone ? 'bg-emerald-500/40' : 'bg-border'}`} aria-hidden="true" />
            )}
          </li>
        );
      })}
    </ol>
  );
}