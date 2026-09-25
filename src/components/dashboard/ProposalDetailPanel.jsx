/**
 * Admin review panel for a single host proposal — full brief, contact details
 * and every stored answer shown with readable labels instead of raw slugs.
 */
import { X } from 'lucide-react';
import { FIELD_LABELS, labelValue, labelList } from '@/lib/proposalLabels';
import ProposalBrandApproval from './ProposalBrandApproval';

const FIELDS = [
  'origin', 'host_type', 'delivery_level', 'category', 'participant_range',
  'winner_method', 'program_scope', 'scale_band', 'review_status',
];

function Row({ label, value }) {
  return (
    <div className="flex justify-between gap-4 py-1.5">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-semibold">{value}</dd>
    </div>
  );
}

export default function ProposalDetailPanel({ proposal, onClose, children }) {
  const a = proposal.answers || {};
  const contact = [
    ['Organisation', a.org_name || proposal.host_organisation_name],
    ['Organisation type', a.org_kind ? labelValue(a.org_kind) : null],
    ['Contact name', a.contact_name],
    ['Contact email', a.org_contact_email || a.host_email],
    ['Contact phone', a.contact_phone],
    ['State', a.org_state],
    ['ABN', a.org_abn],
  ].filter(([, v]) => v);

  return (
    <aside className="h-fit rounded-xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-heading text-lg font-bold">{proposal.challenge_title || 'Untitled challenge'}</h3>
        <button onClick={onClose} aria-label="Close details"><X className="h-4 w-4 text-muted-foreground" /></button>
      </div>

      <div className="mt-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Challenge brief</p>
        <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-foreground">
          {proposal.challenge_description || 'No brief was provided.'}
        </p>
      </div>

      {contact.length > 0 && (
        <div className="mt-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Who to contact</p>
          <dl className="mt-1 divide-y divide-border/60 text-sm">
            {contact.map(([label, value]) => <Row key={label} label={label} value={value} />)}
          </dl>
        </div>
      )}

      <div className="mt-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Challenge setup</p>
        <dl className="mt-1 divide-y divide-border/60 text-sm">
          {FIELDS.map((k) => <Row key={k} label={FIELD_LABELS[k]} value={labelValue(proposal[k])} />)}
          <Row label={FIELD_LABELS.divisions} value={labelList(proposal.divisions)} />
          <Row label={FIELD_LABELS.addons} value={labelList(proposal.addons)} />
        </dl>
      </div>

      {a.beneficiary_name && (
        <div className="mt-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Running it for</p>
          <p className="mt-1 text-sm font-semibold">{a.beneficiary_name}</p>
          {a.beneficiary_note && <p className="mt-1 text-sm text-muted-foreground">{a.beneficiary_note}</p>}
        </div>
      )}

      {proposal.recommended_snapshot && Object.keys(proposal.recommended_snapshot).length > 0 && (
        <div className="mt-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Our recommended setup</p>
          <dl className="mt-1 divide-y divide-border/60 text-sm">
            {Object.entries(proposal.recommended_snapshot).map(([k, v]) => (
              <Row
                key={k}
                label={FIELD_LABELS[k] || labelValue(k)}
                value={Array.isArray(v) ? labelList(v) : labelValue(v)}
              />
            ))}
          </dl>
        </div>
      )}

      <ProposalBrandApproval proposal={proposal} />

      {children}
    </aside>
  );
}