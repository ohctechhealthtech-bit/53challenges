// Panel Progress — per-judge completion across the panel (blind labels).
import { useEffect, useState } from 'react';
import { judgeApi, pickList, pickNum } from '@/lib/judgeApi';
import { PanelLoading, PanelError, PanelEmpty } from '@/components/judge/PanelStates';
import JudgePanelCards from '@/components/judge/JudgePanelCards';

export default function PanelProgressTab({ refreshKey }) {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');

  const load = () => {
    setError('');
    judgeApi('judge-panel-progress')
      .then((d) => setRows(pickList(d, ['panel_progress', 'progress', 'panels', 'judges', 'rows', 'items'])))
      .catch((e) => setError(e.message));
  };
  useEffect(load, [refreshKey]);

  if (error) return <PanelError message={error} onRetry={load} />;
  if (!rows) return <PanelLoading label="Loading panel progress…" />;
  if (!rows.length) return <PanelEmpty message="No panel activity to show yet." />;

  const judges = rows.map((r, i) => ({
    label: r.judge_label || r.label || r.name || `Judge ${i + 1}`,
    is_me: !!(r.is_me || r.is_you),
    submitted: !!(r.submitted ?? (pickNum(r, ['scored', 'entries_scored', 'completed'], 0) >=
      pickNum(r, ['total', 'entries_total', 'assigned'], 0) && pickNum(r, ['total', 'entries_total', 'assigned'], 0) > 0)),
    normalised: r.normalised ?? r.normalised_score ?? null,
    round_title: r.round_title || '',
  }));
  const revealed = rows.every((r) => r.revealed !== false);

  return (
    <div className="space-y-4">
      <JudgePanelCards judges={judges} revealed={revealed} judgesTotal={rows.length} />
      {rows.map((r, i) => {
        const scored = pickNum(r, ['scored', 'entries_scored', 'completed'], 0);
        const total = pickNum(r, ['total', 'entries_total', 'assigned'], 0);
        const pct = pickNum(r, ['percent', 'progress_percent'], total ? Math.round((scored / total) * 100) : 0);
        const label = r.judge_label || r.label || r.name || `Judge ${i + 1}`;
        return (
          <div key={`${r.round_id || ''}-${label}-${i}`} className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center justify-between text-sm">
              <p className="font-semibold">
                {label}
                {r.round_title && <span className="ml-2 font-normal text-muted-foreground">· {r.round_title}</span>}
                {(r.is_me || r.is_you) && <span className="ml-2 rounded-full bg-primary/15 px-2 py-0.5 text-xs font-semibold text-primary">You</span>}
              </p>
              <p className="text-muted-foreground">{scored} / {total} · {pct}%</p>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-secondary" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.min(pct, 100)}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}