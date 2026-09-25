import { Plus, Trash2 } from 'lucide-react';

export default function OperationsPackStep({ template, onChange }) {
  const o = template.operations_pack || {};
  const setPack = (patch) => onChange({ operations_pack: { ...o, ...patch } });
  const milestones = Array.isArray(o.timeline_milestones) ? o.timeline_milestones : [];
  const list = (v) => (Array.isArray(v) ? v.join(', ') : '');
  const toList = (s) => s.split(',').map((x) => x.trim()).filter(Boolean);

  const setItem = (i, patch) =>
    setPack({ timeline_milestones: milestones.map((m, idx) => (idx === i ? { ...m, ...patch } : m)) });

  return (
    <div className="space-y-5">
      <div className="grid gap-5 md:grid-cols-2">
        <label className="block">
          <span className="text-sm font-semibold">Staffing roles required</span>
          <input className="c53-input mt-1.5" placeholder="Producer, moderator, judge coordinator" value={o.staffing_roles || ''} onChange={(e) => setPack({ staffing_roles: e.target.value })} />
        </label>
        <label className="block">
          <span className="text-sm font-semibold">FTE estimate</span>
          <input type="number" min="0" step="0.1" className="c53-input mt-1.5" value={o.fte_estimate ?? ''} onChange={(e) => setPack({ fte_estimate: e.target.value === '' ? null : Number(e.target.value) })} />
        </label>
        <label className="block">
          <span className="text-sm font-semibold">Required integrations</span>
          <input className="c53-input mt-1.5" placeholder="comma separated" value={list(o.required_integrations)} onChange={(e) => setPack({ required_integrations: toList(e.target.value) })} />
        </label>
        <label className="block">
          <span className="text-sm font-semibold">Resource requirements</span>
          <input className="c53-input mt-1.5" placeholder="Venue, printing, equipment" value={o.resource_requirements || ''} onChange={(e) => setPack({ resource_requirements: e.target.value })} />
        </label>
      </div>

      <label className="block">
        <span className="text-sm font-semibold">Hosting and platform requirements</span>
        <textarea rows={3} className="c53-input mt-1.5" value={o.hosting_requirements || ''} onChange={(e) => setPack({ hosting_requirements: e.target.value })} />
      </label>

      <div className="rounded-xl border border-border p-4">
        <p className="text-sm font-semibold">Timeline milestones</p>
        <p className="mt-0.5 text-xs text-muted-foreground">Days before launch that each milestone must be complete.</p>
        <div className="mt-3 space-y-2">
          {milestones.map((m, i) => (
            <div key={i} className="grid gap-2 sm:grid-cols-[1fr_160px_40px]">
              <label className="block">
                <span className="sr-only">Milestone name</span>
                <input className="c53-input" placeholder="Milestone name" value={m.name || ''} onChange={(e) => setItem(i, { name: e.target.value })} />
              </label>
              <label className="block">
                <span className="sr-only">Days before launch</span>
                <input type="number" className="c53-input" placeholder="Days before launch" value={m.days_before_launch ?? ''} onChange={(e) => setItem(i, { days_before_launch: e.target.value === '' ? null : Number(e.target.value) })} />
              </label>
              <button type="button" aria-label="Remove milestone" className="grid place-items-center rounded-xl border border-border" onClick={() => setPack({ timeline_milestones: milestones.filter((_, idx) => idx !== i) })}>
                <Trash2 className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
          ))}
        </div>
        <button type="button" className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-primary" onClick={() => setPack({ timeline_milestones: [...milestones, { name: '', days_before_launch: 0 }] })}>
          <Plus className="h-4 w-4" /> Add milestone
        </button>
      </div>

      <label className="block">
        <span className="text-sm font-semibold">Operations notes</span>
        <textarea rows={3} className="c53-input mt-1.5" value={o.operations_notes || ''} onChange={(e) => setPack({ operations_notes: e.target.value })} />
      </label>
    </div>
  );
}