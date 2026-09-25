import { Pencil, Eye } from 'lucide-react';
import { disciplineList, levelLabel, formatDate } from './judgeMeta';

export default function JudgeRosterTable({ judges = [], onEdit, onView }) {
  if (judges.length === 0) {
    return <p className="mt-4 text-sm text-muted-foreground">No judges match this view.</p>;
  }

  return (
    <div className="mt-4 overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-4 py-3">Judge</th>
            <th className="px-4 py-3">Level</th>
            <th className="px-4 py-3">Expertise</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Assignments</th>
            <th className="px-4 py-3">Added</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {judges.map((j) => (
            <tr key={j.id} className="border-t border-border align-top">
              <td className="px-4 py-3">
                <div className="font-semibold">{j.name || '—'}</div>
                <div className="text-xs text-muted-foreground">{j.email}</div>
              </td>
              <td className="px-4 py-3">{levelLabel(j.level)}</td>
              <td className="max-w-[260px] px-4 py-3 text-muted-foreground">
                {disciplineList(j.disciplines?.length ? j.disciplines : j.categories)}
              </td>
              <td className="px-4 py-3">
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${j.active ? 'bg-success/15 text-success' : 'bg-muted text-muted-foreground'}`}>
                  {j.active ? 'Active' : 'Inactive'}
                </span>
              </td>
              <td className="px-4 py-3">
                <span className="font-semibold">{j.assignment_count ?? 0}</span>
                <span className="ml-1 text-xs text-muted-foreground">
                  ({j.accepted_count ?? 0} accepted · {j.pending_count ?? 0} invited · {j.declined_count ?? 0} declined)
                </span>
              </td>
              <td className="px-4 py-3 text-muted-foreground">{formatDate(j.created_date)}</td>
              <td className="whitespace-nowrap px-4 py-3 text-right">
                <button
                  onClick={() => onView?.(j)}
                  className="mr-2 inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted"
                >
                  <Eye className="h-3.5 w-3.5" /> View
                </button>
                <button
                  onClick={() => onEdit(j)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted"
                >
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}