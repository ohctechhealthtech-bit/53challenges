/**
 * The host's challenge applications — click one to open its detail view.
 */
import { ChevronRight, PlusCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { stageIndex } from '@/components/host/dashboard/ProposalStatusTracker';
import ContentTypeBadge from '@/components/ContentTypeBadge';

const STAGE_LABELS = ['Applied', 'In review', 'Agreement', 'Approved', 'Live'];

export function proposalStageLabel(reviewStatus) {
  if (reviewStatus === 'rejected') return 'Declined';
  return STAGE_LABELS[stageIndex(reviewStatus)];
}

export default function ProposalsPanel({ proposals, selectedId, onSelect }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Your challenges</p>
        <Link to="/host-apply" className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
          <PlusCircle className="h-3.5 w-3.5" /> New application
        </Link>
      </div>
      {proposals.length === 0 ? (
        <p className="py-4 text-sm text-muted-foreground">
          No applications yet — start one and it will show up here.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {proposals.map((p) => {
            const label = proposalStageLabel(p.review_status);
            return (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => onSelect(p.id)}
                  className={`flex w-full items-center justify-between gap-3 rounded-lg px-2 py-2.5 text-left transition-colors hover:bg-muted ${selectedId === p.id ? 'bg-muted' : ''}`}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">{p.challenge_title || 'Untitled challenge'}</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(p.created_date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <ContentTypeBadge value={p.content_type} />
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      p.review_status === 'rejected' ? 'bg-destructive/15 text-destructive'
                      : p.review_status === 'live' ? 'bg-emerald-500/15 text-emerald-300'
                      : 'bg-primary/15 text-primary'
                    }`}>
                      {label}
                    </span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}