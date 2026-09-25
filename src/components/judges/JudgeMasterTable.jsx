/**
 * Judges master list with edit / activate controls.
 */
import { Pencil, Power } from 'lucide-react';

export default function JudgeMasterTable({ judges, onEdit, onToggleActive, busyEmail }) {
  if (judges.length === 0) {
    return <p className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">No judges match this filter yet.</p>;
  }
  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-card">
      <table className="w-full text-sm">
        <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-4 py-3">Judge</th>
            <th className="px-4 py-3">Disciplines</th>
            <th className="px-4 py-3">Level</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {judges.map((j) => (
            <tr key={j.id || j.email} className="border-b border-border/60 last:border-0">
              <td className="px-4 py-3">
                <p className="font-semibold">{j.name}</p>
                <p className="text-xs text-muted-foreground">{j.email}</p>
              </td>
              <td className="px-4 py-3 text-muted-foreground">{(j.disciplines || []).map((d) => d.replace(/_/g, ' ')).join(', ') || '—'}</td>
              <td className="px-4 py-3 text-muted-foreground">{j.level || '—'}</td>
              <td className="px-4 py-3">
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${j.active ? 'bg-success/15 text-success' : 'bg-muted text-muted-foreground'}`}>
                  {j.active ? 'Active' : 'Inactive'}
                </span>
              </td>
              <td className="px-4 py-3 text-right">
                <div className="inline-flex gap-2">
                  <button type="button" onClick={() => onEdit(j)} className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold hover:bg-muted">
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </button>
                  <button
                    type="button"
                    disabled={busyEmail === j.email}
                    onClick={() => onToggleActive(j)}
                    className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold hover:bg-muted disabled:opacity-50"
                  >
                    <Power className="h-3.5 w-3.5" /> {j.active ? 'Deactivate' : 'Activate'}
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}