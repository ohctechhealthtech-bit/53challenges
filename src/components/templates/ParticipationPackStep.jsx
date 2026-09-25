import { Plus, Trash2 } from 'lucide-react';
import { REGISTRATION_TYPES, ENGAGEMENT_TOOLS } from '@/lib/templateLibrary';

function TileGroup({ legend, options, selected, onToggle }) {
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

export default function ParticipationPackStep({ template, onChange }) {
  const p = template.participation_pack || {};
  const setPack = (patch) => onChange({ participation_pack: { ...p, ...patch } });
  const reg = Array.isArray(p.registration_types) ? p.registration_types : [];
  const tools = Array.isArray(p.engagement_tools) ? p.engagement_tools : [];
  const schedule = Array.isArray(p.engagement_schedule) ? p.engagement_schedule : [];

  const toggle = (key, list, value) =>
    setPack({ [key]: list.includes(value) ? list.filter((v) => v !== value) : [...list, value] });

  const setItem = (i, patch) =>
    setPack({ engagement_schedule: schedule.map((s, idx) => (idx === i ? { ...s, ...patch } : s)) });

  return (
    <div className="space-y-5">
      <TileGroup legend="Registration types" options={REGISTRATION_TYPES} selected={reg} onToggle={(v) => toggle('registration_types', reg, v)} />
      <TileGroup legend="Community engagement tools" options={ENGAGEMENT_TOOLS} selected={tools} onToggle={(v) => toggle('engagement_tools', tools, v)} />

      <div className="rounded-xl border border-border p-4">
        <p className="text-sm font-semibold">Engagement schedule</p>
        <p className="mt-0.5 text-xs text-muted-foreground">Milestones participants move through, counted in days from the challenge opening.</p>
        <div className="mt-3 space-y-2">
          {schedule.map((s, i) => (
            <div key={i} className="grid gap-2 sm:grid-cols-[1fr_140px_40px]">
              <label className="block">
                <span className="sr-only">Milestone label</span>
                <input className="c53-input" placeholder="Milestone label" value={s.label || ''} onChange={(e) => setItem(i, { label: e.target.value })} />
              </label>
              <label className="block">
                <span className="sr-only">Due offset in days</span>
                <input type="number" className="c53-input" placeholder="Day offset" value={s.due_offset_days ?? ''} onChange={(e) => setItem(i, { due_offset_days: e.target.value === '' ? null : Number(e.target.value) })} />
              </label>
              <button type="button" aria-label="Remove milestone" className="grid place-items-center rounded-xl border border-border" onClick={() => setPack({ engagement_schedule: schedule.filter((_, idx) => idx !== i) })}>
                <Trash2 className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
          ))}
        </div>
        <button type="button" className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-primary" onClick={() => setPack({ engagement_schedule: [...schedule, { label: '', due_offset_days: 0 }] })}>
          <Plus className="h-4 w-4" /> Add milestone
        </button>
      </div>

      <label className="block">
        <span className="text-sm font-semibold">Participation notes</span>
        <textarea rows={3} className="c53-input mt-1.5" value={p.participation_notes || ''} onChange={(e) => setPack({ participation_notes: e.target.value })} />
      </label>
    </div>
  );
}