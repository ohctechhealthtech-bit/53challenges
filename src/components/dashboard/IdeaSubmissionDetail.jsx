/** Full detail of one "Tell us your idea" submission, with status control. */
import { useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { hostPortal } from '@/lib/hostPortalClient';
import { ideaLabel, ideaLabels } from '@/components/dashboard/ideaLabels';
import IdeaStatusButtons from '@/components/dashboard/IdeaStatusButtons';
import IdeaJudgingDetail from '@/components/dashboard/IdeaJudgingDetail';

function Row({ label, value }) {
  return (
    <div className="grid grid-cols-3 gap-3 border-b border-border py-2 text-sm last:border-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="col-span-2 font-medium">{value || '—'}</dd>
    </div>
  );
}

export default function IdeaSubmissionDetail({ idea, onClose, onUpdated }) {
  const a = idea.answers || {};
  const [status, setStatus] = useState(idea.review_status || 'new');
  const [saving, setSaving] = useState(false);

  const save = async (value) => {
    setStatus(value);
    setSaving(true);
    try {
      await hostPortal('set_idea_status', { id: idea.id, review_status: value });
      onUpdated?.();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-heading text-lg font-bold">{idea.challenge_title || 'Untitled idea'}</h3>
          <p className="text-sm text-muted-foreground">
            {a.name} · {a.email} {a.phone ? `· ${a.phone}` : ''}
          </p>
        </div>
        <button onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground" aria-label="Close">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-4">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold">Status</p>
          {saving ? <Loader2 className="h-4 w-4 animate-spin text-primary" /> : null}
        </div>
        <div className="mt-2">
          <IdeaStatusButtons value={status} onChange={save} disabled={saving} />
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-primary/30 bg-primary/5 p-4">
        <h4 className="text-sm font-bold text-primary">Sponsor objectives</h4>
        <dl className="mt-2">
          <Row label="Main goal" value={ideaLabel('primary_objective', a.primary_objective)} />
          <Row label="Other goals" value={ideaLabels('secondary_objectives', a.secondary_objectives)} />
          <Row label="Action for participants" value={a.participant_next_action} />
        </dl>
      </div>

      <div className="mt-4 rounded-2xl border border-border bg-card p-4">
        <h4 className="text-sm font-bold">Rules &amp; guardrails</h4>
        <p className="mt-2 text-sm font-medium">{ideaLabels('rules_expectations', a.rules_expectations)}</p>
        {a.rules_notes ? (
          <p className="mt-3 whitespace-pre-wrap rounded-xl bg-muted p-3 text-sm text-muted-foreground">
            {a.rules_notes}
          </p>
        ) : null}
      </div>

      <IdeaJudgingDetail answers={a} />

      <div className="mt-4 rounded-2xl border border-border bg-card p-4">
        <h4 className="text-sm font-bold">Contact &amp; organisation</h4>
        <dl className="mt-2">
          <Row label="Contact name" value={a.name} />
          <Row label="Email" value={a.email} />
          <Row label="Phone" value={a.phone} />
          <Row label="Organisation" value={a.organisation_name} />
          <Row label="Kind of organisation" value={ideaLabel('org_kind', a.org_kind)} />
          <Row label="State" value={a.org_state} />
          <Row label="ABN" value={a.org_abn} />
          <Row label="Challenge is for" value={a.beneficiary_name} />
          <Row label="About them" value={<span className="whitespace-pre-wrap">{a.beneficiary_notes}</span>} />
        </dl>
      </div>

      <dl className="mt-5">
        <Row label="Started from template" value={a.template_name} />
        <Row label="Hosting for" value={ideaLabel('org_type', a.org_type)} />
        <Row label="Kind of activity" value={ideaLabel('activity_type', a.activity_type)} />
        <Row label="Their idea" value={<span className="whitespace-pre-wrap">{idea.challenge_description}</span>} />
        <Row label="Who can enter" value={ideaLabels('age_groups', a.age_groups)} />
        <Row label="Expected numbers" value={ideaLabel('participants', a.participants)} />
        <Row label="Reach" value={ideaLabel('reach', a.reach)} />
        <Row label="Winner decided by" value={ideaLabel('winner_method', a.winner_method)} />
        <Row label="One-off or ongoing" value={ideaLabel('scope', a.scope)} />
        <Row label="Timing" value={ideaLabel('timing', a.timing)} />
        <Row label="Prizes" value={ideaLabel('prize_pool', a.prize_pool)} />
        <Row label="Budget" value={ideaLabel('budget', a.budget)} />
        <Row label="Extra notes" value={<span className="whitespace-pre-wrap">{a.extra_notes}</span>} />
      </dl>
    </div>
  );
}