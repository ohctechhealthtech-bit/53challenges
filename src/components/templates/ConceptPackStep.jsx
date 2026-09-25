import { SERVICE_TIERS, ENTRY_TYPES, DELIVERY_MODES } from '@/lib/templateLibrary';

function Field({ label, children, hint }) {
  return (
    <label className="block">
      <span className="text-sm font-semibold">{label}</span>
      {hint && <span className="ml-2 text-xs text-muted-foreground">{hint}</span>}
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

export default function ConceptPackStep({ template, onChange }) {
  const c = template.concept_pack || {};
  const setPack = (patch) => onChange({ concept_pack: { ...c, ...patch } });
  const list = (v) => (Array.isArray(v) ? v.join(', ') : '');
  const toList = (s) => s.split(',').map((x) => x.trim()).filter(Boolean);

  return (
    <div className="grid gap-5 md:grid-cols-2">
      <Field label="Template name">
        <input className="c53-input" value={template.template_name || ''} onChange={(e) => onChange({ template_name: e.target.value })} />
      </Field>
      <Field label="Package name">
        <input className="c53-input" value={c.package_name || ''} onChange={(e) => setPack({ package_name: e.target.value })} />
      </Field>
      <Field label="Primary category">
        <input className="c53-input" value={template.primary_category_id || ''} onChange={(e) => onChange({ primary_category_id: e.target.value, concept_pack: { ...c, primary_category_id: e.target.value } })} />
      </Field>
      <Field label="Subcategory" hint="optional">
        <input className="c53-input" value={template.subcategory_id || ''} onChange={(e) => onChange({ subcategory_id: e.target.value })} />
      </Field>
      <Field label="Service tier">
        <select className="c53-input" value={template.service_tier || 'standard'} onChange={(e) => onChange({ service_tier: e.target.value })}>
          {SERVICE_TIERS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </Field>
      <Field label="Recommended duration (weeks)">
        <input type="number" min="1" className="c53-input" value={c.recommended_duration_weeks || ''} onChange={(e) => setPack({ recommended_duration_weeks: Number(e.target.value) })} />
      </Field>
      <Field label="Entry type">
        <select className="c53-input" value={c.entry_type || 'individual'} onChange={(e) => setPack({ entry_type: e.target.value })}>
          {ENTRY_TYPES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </Field>
      <Field label="Delivery mode">
        <select className="c53-input" value={c.delivery_mode || 'online'} onChange={(e) => setPack({ delivery_mode: e.target.value })}>
          {DELIVERY_MODES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </Field>
      <Field label="Objectives" hint="comma separated">
        <input className="c53-input" value={list(c.corporate_objective)} onChange={(e) => setPack({ corporate_objective: toList(e.target.value) })} />
      </Field>
      <Field label="Target audience" hint="comma separated">
        <input className="c53-input" value={list(c.target_audience)} onChange={(e) => setPack({ target_audience: toList(e.target.value) })} />
      </Field>
      <div className="md:col-span-2">
        <Field label="Challenge description" hint="at least 40 characters">
          <textarea rows={4} className="c53-input" value={c.challenge_description || ''} onChange={(e) => setPack({ challenge_description: e.target.value })} />
        </Field>
      </div>
      <div className="md:col-span-2">
        <Field label="Expected outcome">
          <textarea rows={3} className="c53-input" value={c.expected_outcome || ''} onChange={(e) => setPack({ expected_outcome: e.target.value })} />
        </Field>
      </div>
      <div className="md:col-span-2">
        <Field label="Recommended prize structure">
          <textarea rows={3} className="c53-input" value={c.recommended_prize_structure || ''} onChange={(e) => setPack({ recommended_prize_structure: e.target.value })} />
        </Field>
      </div>
    </div>
  );
}