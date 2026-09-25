/**
 * D8 — Host Experience Principles.
 * Rules applied: D8.1 (plain language — no raw keys or internal terms shown).
 */
import { getAddon } from '@/lib/hostAddons';
import { DELIVERY_LEVELS, PARTICIPANT_RANGES } from '@/lib/hostWizardDefaults';
import {
  CATEGORY_OPTIONS, WINNER_OPTIONS, DIVISION_OPTIONS, SCOPE_OPTIONS, HOST_TYPE_OPTIONS,
} from '@/components/host/applySteps';

const labelOf = (list, v) => list.find((o) => o.value === v)?.label || '—';

export default function WorkspaceSummary({ proposal }) {
  const rows = [
    { label: 'Running it for', value: labelOf(HOST_TYPE_OPTIONS, proposal.host_type) },
    { label: 'How much help', value: DELIVERY_LEVELS.find((d) => d.key === proposal.delivery_level)?.label || '—' },
    { label: 'Kind of entries', value: labelOf(CATEGORY_OPTIONS, proposal.category) },
    { label: 'Expected entrants', value: PARTICIPANT_RANGES.find((r) => r.key === proposal.participant_range)?.label || '—' },
    { label: 'How the winner is decided', value: labelOf(WINNER_OPTIONS, proposal.winner_method) },
    {
      label: 'Who can enter',
      value: (proposal.divisions || []).map((d) => labelOf(DIVISION_OPTIONS, d)).join(', ') || '—',
    },
    { label: 'One-off or ongoing', value: labelOf(SCOPE_OPTIONS, proposal.program_scope) },
  ];

  const addons = (proposal.addons || []).map((k) => getAddon(k)).filter(Boolean);

  return (
    <div className="space-y-6">
      {proposal.challenge_description && (
        <div className="rounded-2xl border border-border bg-card p-5">
          <h2 className="font-heading text-sm font-bold">What it's about</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{proposal.challenge_description}</p>
        </div>
      )}

      <dl className="grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-2">
        {rows.map((r) => (
          <div key={r.label} className="bg-card p-4">
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{r.label}</dt>
            <dd className="mt-1 text-sm font-semibold">{r.value}</dd>
          </div>
        ))}
      </dl>

      <div>
        <h2 className="font-heading text-sm font-bold">Services you've asked for</h2>
        {addons.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">None yet — you can add these any time.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {addons.map((a) => (
              <li key={a.key} className="rounded-2xl border border-border bg-card p-4">
                <p className="font-heading text-sm font-bold">{a.name}</p>
                <p className="mt-1 text-xs text-muted-foreground">{a.description}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}