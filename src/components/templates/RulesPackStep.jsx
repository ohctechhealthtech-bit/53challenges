import { Plus, Trash2, AlertTriangle } from 'lucide-react';
import { AGE_GROUPS, WINNER_METHODS, JUDGING_METHODS, AI_POLICIES } from '@/lib/templateLibrary';

export default function RulesPackStep({ template, onChange }) {
  const r = template.rules_pack || {};
  const setPack = (patch) => onChange({ rules_pack: { ...r, ...patch } });
  const criteria = Array.isArray(r.judging_criteria) ? r.judging_criteria : [];
  const total = criteria.reduce((s, c) => s + Number(c.weight || 0), 0);
  const needsJudging = JUDGING_METHODS.includes(r.winner_selection_method);
  const list = (v) => (Array.isArray(v) ? v.join(', ') : '');
  const toList = (s) => s.split(',').map((x) => x.trim()).filter(Boolean);

  const setCriterion = (i, patch) => {
    const next = criteria.map((c, idx) => (idx === i ? { ...c, ...patch } : c));
    setPack({ judging_criteria: next });
  };

  return (
    <div className="space-y-5">
      <label className="block">
        <span className="text-sm font-semibold">Eligibility summary</span>
        <textarea rows={3} className="c53-input mt-1.5" value={r.eligibility_summary || ''} onChange={(e) => setPack({ eligibility_summary: e.target.value })} />
      </label>

      <fieldset>
        <legend className="text-sm font-semibold">Age groups</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {AGE_GROUPS.map((g) => {
            const checked = (r.age_groups || []).includes(g.value);
            return (
              <label key={g.value} className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm ${checked ? 'border-primary bg-primary/10' : 'border-border'}`}>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => setPack({ age_groups: checked ? r.age_groups.filter((v) => v !== g.value) : [...(r.age_groups || []), g.value] })}
                />
                {g.label}
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="grid gap-5 md:grid-cols-2">
        <label className="block">
          <span className="text-sm font-semibold">Eligible locations</span>
          <input className="c53-input mt-1.5" placeholder="NSW, VIC, QLD" value={list(r.eligible_locations)} onChange={(e) => setPack({ eligible_locations: toList(e.target.value) })} />
        </label>
        <label className="block">
          <span className="text-sm font-semibold">Winner selection method</span>
          <select className="c53-input mt-1.5" value={r.winner_selection_method || 'expert_judging'} onChange={(e) => setPack({ winner_selection_method: e.target.value })}>
            {WINNER_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="text-sm font-semibold">AI use policy</span>
          <select className="c53-input mt-1.5" value={r.ai_use_policy || 'human_only'} onChange={(e) => setPack({ ai_use_policy: e.target.value })}>
            {AI_POLICIES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="text-sm font-semibold">Entry limit per participant</span>
          <input type="number" min="1" className="c53-input mt-1.5" value={r.entry_limit_per_participant || 1} onChange={(e) => setPack({ entry_limit_per_participant: Number(e.target.value) })} />
        </label>
        <label className="block">
          <span className="text-sm font-semibold">Minimum team size</span>
          <input type="number" min="0" className="c53-input mt-1.5" value={r.team_size_minimum ?? ''} onChange={(e) => setPack({ team_size_minimum: e.target.value === '' ? null : Number(e.target.value) })} />
        </label>
        <label className="block">
          <span className="text-sm font-semibold">Maximum team size</span>
          <input type="number" min="0" className="c53-input mt-1.5" value={r.team_size_maximum ?? ''} onChange={(e) => setPack({ team_size_maximum: e.target.value === '' ? null : Number(e.target.value) })} />
        </label>
      </div>

      {r.winner_selection_method === 'random_draw' && (
        <p className="flex items-start gap-2 rounded-xl border border-gold/40 bg-gold/10 p-3 text-sm text-foreground">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
          Random draw templates will require jurisdiction and permit assessment in the compliance phase.
        </p>
      )}

      {needsJudging && (
        <div className="rounded-xl border border-border p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Judging criteria</p>
            <span className={`text-xs font-bold ${total === 100 ? 'text-success' : 'text-destructive'}`}>Total weight: {total}/100</span>
          </div>
          <div className="mt-3 space-y-2">
            {criteria.map((c, i) => (
              <div key={i} className="grid gap-2 sm:grid-cols-[1fr_2fr_90px_40px]">
                <input className="c53-input" placeholder="Criterion" value={c.criterion || ''} onChange={(e) => setCriterion(i, { criterion: e.target.value })} />
                <input className="c53-input" placeholder="Description" value={c.description || ''} onChange={(e) => setCriterion(i, { description: e.target.value })} />
                <input type="number" className="c53-input" placeholder="Weight" value={c.weight ?? ''} onChange={(e) => setCriterion(i, { weight: Number(e.target.value) })} />
                <button type="button" aria-label="Remove criterion" className="grid place-items-center rounded-xl border border-border" onClick={() => setPack({ judging_criteria: criteria.filter((_, idx) => idx !== i) })}>
                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>
            ))}
          </div>
          <button type="button" className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-primary" onClick={() => setPack({ judging_criteria: [...criteria, { criterion: '', description: '', weight: 0 }] })}>
            <Plus className="h-4 w-4" /> Add criterion
          </button>
        </div>
      )}

      <div className="grid gap-5 md:grid-cols-2">
        <label className="block">
          <span className="text-sm font-semibold">Required declarations</span>
          <input className="c53-input mt-1.5" placeholder="comma separated" value={list(r.required_declarations)} onChange={(e) => setPack({ required_declarations: toList(e.target.value) })} />
        </label>
        <label className="block">
          <span className="text-sm font-semibold">Prohibited AI uses</span>
          <input className="c53-input mt-1.5" placeholder="comma separated" value={list(r.prohibited_ai_uses)} onChange={(e) => setPack({ prohibited_ai_uses: toList(e.target.value) })} />
        </label>
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" checked={!!r.ai_disclosure_required} onChange={(e) => setPack({ ai_disclosure_required: e.target.checked })} />
          AI disclosure required
        </label>
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" checked={!!r.human_contribution_statement_required} onChange={(e) => setPack({ human_contribution_statement_required: e.target.checked })} />
          Human contribution statement required
        </label>
      </div>

      <label className="block">
        <span className="text-sm font-semibold">Prohibited content summary</span>
        <textarea rows={3} className="c53-input mt-1.5" value={r.prohibited_content_summary || ''} onChange={(e) => setPack({ prohibited_content_summary: e.target.value })} />
      </label>
      <label className="block">
        <span className="text-sm font-semibold">Tie-breaking method</span>
        <textarea rows={2} className="c53-input mt-1.5" value={r.tie_breaking_method || ''} onChange={(e) => setPack({ tie_breaking_method: e.target.value })} />
      </label>
    </div>
  );
}