/**
 * D8 — Host Experience Principles.
 * Rules applied: D8.1 (plain language), D8.3 (checklist + calm status panels),
 * D8.4 (host status vocabulary), D8.5 (named team roles), D8.6 (routing invisible).
 */
import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Loader2, ArrowLeft } from 'lucide-react';
import OnboardingChecklist from '@/components/host/OnboardingChecklist';
import StatusPanel from '@/components/host/StatusPanel';
import TeamPanel from '@/components/host/TeamPanel';
import WorkspaceSummary from '@/components/host/WorkspaceSummary';
import WorkspaceEditor from '@/components/host/WorkspaceEditor';

const EDITABLE_STATUSES = ['intake_received', 'changes_requested', 'builder_started'];
import { getHostStatusLabel } from '@/lib/hostStatusLabels';

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'details', label: 'Your challenge' },
  { key: 'team', label: 'Team' },
];

export default function HostWorkspace() {
  const { id } = useParams();
  const [proposal, setProposal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('overview');

  useEffect(() => {
    (async () => {
      const p = await base44.entities.ChallengeDraft.get(id).catch(() => null);
      setProposal(p);
      setLoading(false);
    })();
  }, [id]);

  if (loading) {
    return (
      <main className="container-tight flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </main>
    );
  }

  if (!proposal) {
    return (
      <main className="container-tight py-16">
        <StatusPanel
          tone="progress"
          title="We couldn't find that challenge"
          message="It may have been removed, or you may have followed an old link."
          action={<Link to="/my-challenge-proposals" className="text-sm font-semibold text-primary underline">Back to my challenges</Link>}
        />
      </main>
    );
  }

  const status = getHostStatusLabel(proposal.review_status, {
    note: proposal.admin_feedback,
    reason: proposal.decline_reason,
  });

  return (
    <main className="container-tight py-10 sm:py-14">
      <Link to="/my-challenge-proposals" className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> My challenges
      </Link>

      <h1 className="font-heading text-3xl font-extrabold sm:text-4xl">
        {proposal.challenge_title || 'Your challenge'}
      </h1>

      <div className="mt-8 rounded-2xl border border-border bg-card p-5">
        <OnboardingChecklist currentStep={status.step} />
      </div>

      <div className="mt-8 flex gap-1 border-b border-border" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors ${
              tab === t.key ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {tab === 'overview' && (
          <div className="space-y-4">
            <StatusPanel
              tone={status.tone}
              title={status.label}
              message={status.detail}
              timeframe={
                status.tone === 'progress'
                  ? "Our team usually gets back to you within 1 business day — we'll let you know as soon as there's news."
                  : null
              }
            />
            {status.tone === 'progress' && (
              <StatusPanel
                tone="progress"
                title="Nothing needed from you right now"
                message="Under review by the 53 Challenges team — we'll notify you when this step is complete."
              />
            )}
          </div>
        )}
        {tab === 'details' && (
          EDITABLE_STATUSES.includes(proposal.review_status) ? (
            <WorkspaceEditor
              proposal={proposal}
              onSaved={async () => {
                const p = await base44.entities.ChallengeDraft.get(id).catch(() => null);
                if (p) setProposal(p);
              }}
            />
          ) : (
            <div className="space-y-5">
              <StatusPanel
                tone="progress"
                title="Your challenge details are locked while it is under review."
                message="If something needs changing, let us know and we'll reopen it for you."
              />
              <WorkspaceSummary proposal={proposal} />
            </div>
          )
        )}
        {tab === 'team' && <TeamPanel proposalId={proposal.id} />}
      </div>
    </main>
  );
}