// Results — ranked outcomes with aggregate score, judge count and
// tie-break data. Only revealed panels appear here.
import { useEffect, useState } from 'react';
import { Trophy } from 'lucide-react';
import { judgeApi, pickList, pickNum } from '@/lib/judgeApi';
import { PanelLoading, PanelError, PanelEmpty } from '@/components/judge/PanelStates';

export default function ResultsTab({ refreshKey }) {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');

  const load = () => {
    setError('');
    judgeApi('judge-results')
      .then((d) => setRows(pickList(d, ['results', 'rows', 'items'])))
      .catch((e) => setError(e.message));
  };
  useEffect(load, [refreshKey]);

  if (error) return <PanelError message={error} onRetry={load} />;
  if (!rows) return <PanelLoading label="Loading results…" />;
  if (!rows.length) {
    return <PanelEmpty message="No results are revealed yet — they appear once every judge on a panel has submitted." />;
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-card">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th className="p-3">Rank</th>
            <th className="p-3">Entry</th>
            <th className="p-3 text-right">Score</th>
            <th className="p-3 text-right">Judges</th>
            <th className="p-3">Tie-break</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const rank = pickNum(r, ['rank', 'official_rank', 'position'], i + 1);
            const score = pickNum(r, ['aggregate_judge_score', 'aggregate_score', 'score', 'total_score'], null);
            const judges = pickNum(r, ['judge_count', 'judges'], null);
            const tb = r.tie_break;
            const tieBreak = typeof tb === 'string'
              ? tb
              : tb?.pending
                ? 'Pending'
                : tb?.chief_judge_pick
                  ? 'Chief judge pick'
                  : typeof tb?.theme_interpretation_avg === 'number'
                    ? `Theme avg ${tb.theme_interpretation_avg}`
                    : '—';
            return (
              <tr key={r.id || i} className="border-b border-border/60 last:border-0">
                <td className="p-3 font-heading font-bold">
                  {rank <= 3 ? <span className="inline-flex items-center gap-1">{rank} <Trophy className="h-3.5 w-3.5 text-gold" /></span> : rank}
                </td>
                <td className="p-3">
                  <p className="font-semibold">{r.entry_title || r.title || 'Untitled entry'}</p>
                  <p className="text-xs text-muted-foreground">{r.participant_display_name || r.entrant_name || r.entrant_label || ''}</p>
                </td>
                <td className="p-3 text-right font-semibold">{score === null ? '—' : score}</td>
                <td className="p-3 text-right text-muted-foreground">{judges === null ? '—' : judges}</td>
                <td className="p-3 text-xs text-muted-foreground">{tieBreak}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}