import { formatDateTime, prettyList, STATUS_TONE } from './panelMeta';

export default function PanelMembersTable({ members, onOpen, onRemove }) {
  if (!members.length) {
    return <p className="mt-4 text-sm text-muted-foreground">No judges are on this panel yet — invite one below.</p>;
  }

  return (
    <div className="mt-4 overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-4 py-3">Judge</th>
            <th className="px-4 py-3">State</th>
            <th className="px-4 py-3">Scoring</th>
            <th className="px-4 py-3">Invited</th>
            <th className="px-4 py-3">Stepped back from</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {members.map((m) => {
            const cancelled = m.status === 'cancelled';
            return (
              <tr key={m.id} className="border-t border-border align-top">
                <td className="px-4 py-3">
                  <div className="font-semibold">{m.display_name || m.judge_name || m.judge_email}</div>
                  <div className="text-xs text-muted-foreground">{m.judge_email}</div>
                </td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_TONE[m.status] || 'bg-muted text-muted-foreground'}`}>
                    {m.status_label || m.status}
                  </span>
                  {!m.can_score && <div className="mt-1 text-xs text-muted-foreground">Cannot score</div>}
                  {m.cancel_reason && <div className="mt-1 text-xs text-muted-foreground">{m.cancel_reason}</div>}
                </td>
                <td className="px-4 py-3">
                  <div className="font-semibold">{m.scored_entries ?? 0}/{m.scorable_entries ?? 0} scored</div>
                  <div className="text-xs text-muted-foreground">{m.scoring_complete ? 'Complete' : 'In progress'}</div>
                </td>
                <td className="px-4 py-3">
                  <div>{formatDateTime(m.assigned_at)}</div>
                  <div className="text-xs text-muted-foreground">
                    {m.assigned_by_email ? `by ${m.assigned_by_email}` : 'invited by the system'}
                  </div>
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{prettyList(m.recused_categories)}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-col items-stretch gap-1.5">
                    <button
                      onClick={() => onOpen(m)}
                      className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted"
                    >
                      View judge
                    </button>
                    <button
                      onClick={() => onRemove(m)}
                      disabled={cancelled}
                      className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {cancelled ? 'Removed' : 'Remove'}
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}