import { useState } from 'react';
import { Lock } from 'lucide-react';
import { AGE_GROUPS, WINNER_METHODS, AI_POLICIES, ENTRY_TYPES, DELIVERY_MODES, REGISTRATION_TYPES, ENGAGEMENT_TOOLS, PERMIT_TYPES, labelFor } from '@/lib/templateLibrary';

const TABS = ['Concept', 'Rules', 'Brand', 'Participation', 'Operations', 'Legal'];

function Row({ label, value }) {
  return (
    <div className="grid gap-1 py-2 sm:grid-cols-[220px_1fr]">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="whitespace-pre-line text-sm font-medium">{value || '—'}</dd>
    </div>
  );
}

function MilestoneRow({ label, items, render }) {
  const list = Array.isArray(items) ? items : [];
  return (
    <div className="grid gap-1 py-2 sm:grid-cols-[220px_1fr]">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium">
        {list.length === 0 ? '—' : (
          <ol className="list-decimal space-y-0.5 pl-5">
            {list.map((it, i) => <li key={i}>{render(it)}</li>)}
          </ol>
        )}
      </dd>
    </div>
  );
}

const joinLabels = (options, values) => (Array.isArray(values) ? values.map((v) => labelFor(options, v)).join(', ') : '');

export default function TemplatePackTabs({ template }) {
  const [tab, setTab] = useState('Concept');
  const c = template.concept_pack || {};
  const r = template.rules_pack || {};
  const b = template.brand_pack || {};
  const p = template.participation_pack || {};
  const o = template.operations_pack || {};
  const l = template.legal_pack || {};
  const lockMap = template.lock_map || {};

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${tab === t ? 'bg-primary text-primary-foreground' : 'border border-border text-muted-foreground hover:text-foreground'}`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="mt-4">

        {tab === 'Concept' && (
          <dl className="divide-y divide-border/60">
            <Row label="Package name" value={c.package_name} />
            <Row label="Objectives" value={(c.corporate_objective || []).join(', ')} />
            <Row label="Target audience" value={(c.target_audience || []).join(', ')} />
            <Row label="Description" value={c.challenge_description} />
            <Row label="Expected outcome" value={c.expected_outcome} />
            <Row label="Entry type" value={labelFor(ENTRY_TYPES, c.entry_type)} />
            <Row label="Delivery mode" value={labelFor(DELIVERY_MODES, c.delivery_mode)} />
            <Row label="Recommended duration" value={c.recommended_duration_weeks ? `${c.recommended_duration_weeks} weeks` : ''} />
            <Row label="Prize structure" value={c.recommended_prize_structure} />
          </dl>
        )}

        {tab === 'Rules' && (
          <dl className="divide-y divide-border/60">
            <Row label="Eligibility" value={r.eligibility_summary} />
            <Row label="Age groups" value={(r.age_groups || []).map((g) => labelFor(AGE_GROUPS, g)).join(', ')} />
            <Row label="Eligible locations" value={(r.eligible_locations || []).join(', ')} />
            <Row label="Winner selection" value={labelFor(WINNER_METHODS, r.winner_selection_method)} />
            <Row label="Judging criteria" value={(r.judging_criteria || []).map((x) => `${x.criterion} (${x.weight}%)`).join(', ')} />
            <Row label="AI use policy" value={labelFor(AI_POLICIES, r.ai_use_policy)} />
            <Row label="AI disclosure required" value={r.ai_disclosure_required ? 'Yes' : 'No'} />
            <Row label="Prohibited AI uses" value={(r.prohibited_ai_uses || []).join(', ')} />
            <Row label="Required declarations" value={(r.required_declarations || []).join(', ')} />
            <Row label="Prohibited content" value={r.prohibited_content_summary} />
            <Row label="Tie-breaking" value={r.tie_breaking_method} />
            <Row label="Entry limit" value={r.entry_limit_per_participant} />
            <Row label="Team size" value={r.team_size_minimum ? `${r.team_size_minimum}–${r.team_size_maximum}` : ''} />
          </dl>
        )}

        {tab === 'Brand' && (
          <>
            <p className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
              <Lock className="h-3.5 w-3.5" /> Concept and Rules are always locked for hosts. Brand fields marked “host” may be customised.
            </p>
            <dl className="divide-y divide-border/60">
              {Object.entries(b).map(([k, v]) => (
                <Row
                  key={k}
                  label={`${k.replace(/_/g, ' ')} ${lockMap[k] === 'host_editable' ? '(host)' : '(admin)'}`}
                  value={Array.isArray(v) ? v.join(' · ') : typeof v === 'boolean' ? (v ? 'Yes' : 'No') : v}
                />
              ))}
            </dl>
          </>
        )}

        {tab === 'Participation' && (
          <dl className="divide-y divide-border/60">
            <Row label="Registration types" value={joinLabels(REGISTRATION_TYPES, p.registration_types)} />
            <Row label="Community engagement tools" value={joinLabels(ENGAGEMENT_TOOLS, p.engagement_tools)} />
            <MilestoneRow
              label="Engagement schedule"
              items={p.engagement_schedule}
              render={(it) => `${it.label || 'Untitled'} — day ${it.due_offset_days ?? 0}`}
            />
            <Row label="Participation notes" value={p.participation_notes} />
          </dl>
        )}

        {tab === 'Operations' && (
          <dl className="divide-y divide-border/60">
            <Row label="Staffing roles" value={o.staffing_roles} />
            <Row label="FTE estimate" value={o.fte_estimate ?? ''} />
            <Row label="Required integrations" value={(o.required_integrations || []).join(', ')} />
            <Row label="Resource requirements" value={o.resource_requirements} />
            <Row label="Hosting requirements" value={o.hosting_requirements} />
            <MilestoneRow
              label="Timeline milestones"
              items={o.timeline_milestones}
              render={(it) => `${it.name || 'Untitled'} — ${it.days_before_launch ?? 0} days before launch`}
            />
            <Row label="Operations notes" value={o.operations_notes} />
          </dl>
        )}

        {tab === 'Legal' && (
          <dl className="divide-y divide-border/60">
            <Row label="Applicable jurisdictions" value={(l.applicable_jurisdictions || []).join(', ')} />
            <Row label="Required permit types" value={joinLabels(PERMIT_TYPES, l.required_permit_types)} />
            <Row label="Rights grant template" value={l.rights_grant_template_ref} />
            <Row label="Governing law" value={l.governing_law} />
            <Row label="Override notes" value={l.override_notes} />
          </dl>
        )}
      </div>
    </div>
  );
}