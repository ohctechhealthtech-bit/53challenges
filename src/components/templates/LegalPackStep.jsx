import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { PERMIT_TYPES } from '@/lib/templateLibrary';

const FALLBACK_JURISDICTIONS = ['NSW', 'VIC', 'QLD', 'SA', 'WA', 'TAS', 'NT', 'ACT', 'National'];

function CheckGrid({ legend, options, selected, onToggle }) {
  return (
    <fieldset>
      <legend className="text-sm font-semibold">{legend}</legend>
      <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {options.map((o) => {
          const checked = selected.includes(o.value);
          return (
            <label key={o.value} className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm ${checked ? 'border-primary bg-primary/10' : 'border-border'}`}>
              <input type="checkbox" checked={checked} onChange={() => onToggle(o.value)} />
              {o.label}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

export default function LegalPackStep({ template, onChange }) {
  const l = template.legal_pack || {};
  const setPack = (patch) => onChange({ legal_pack: { ...l, ...patch } });
  const jurisdictions = Array.isArray(l.applicable_jurisdictions) ? l.applicable_jurisdictions : [];
  const permits = Array.isArray(l.required_permit_types) ? l.required_permit_types : [];
  const [jurisdictionOptions, setJurisdictionOptions] = useState(
    FALLBACK_JURISDICTIONS.map((v) => ({ value: v, label: v }))
  );

  useEffect(() => {
    base44.entities.Jurisdiction.list().then((rows) => {
      const opts = (rows || [])
        .map((r) => r.code || r.name)
        .filter(Boolean)
        .map((v) => ({ value: v, label: v }));
      if (opts.length) setJurisdictionOptions(opts);
    }).catch(() => {});
  }, []);

  const toggle = (key, current, value) =>
    setPack({ [key]: current.includes(value) ? current.filter((v) => v !== value) : [...current, value] });

  return (
    <div className="space-y-5">
      <CheckGrid legend="Applicable jurisdictions" options={jurisdictionOptions} selected={jurisdictions} onToggle={(v) => toggle('applicable_jurisdictions', jurisdictions, v)} />
      <CheckGrid legend="Required permit types" options={PERMIT_TYPES} selected={permits} onToggle={(v) => toggle('required_permit_types', permits, v)} />

      <div className="grid gap-5 md:grid-cols-2">
        <label className="block">
          <span className="text-sm font-semibold">Rights grant template reference</span>
          <input className="c53-input mt-1.5" placeholder="Template ID or reference" value={l.rights_grant_template_ref || ''} onChange={(e) => setPack({ rights_grant_template_ref: e.target.value })} />
        </label>
        <label className="block">
          <span className="text-sm font-semibold">Governing law</span>
          <input className="c53-input mt-1.5" placeholder="e.g. Queensland, Australia" value={l.governing_law || ''} onChange={(e) => setPack({ governing_law: e.target.value })} />
        </label>
      </div>

      <label className="block">
        <span className="text-sm font-semibold">Override notes</span>
        <textarea rows={4} className="c53-input mt-1.5" value={l.override_notes || ''} onChange={(e) => setPack({ override_notes: e.target.value })} />
      </label>
    </div>
  );
}