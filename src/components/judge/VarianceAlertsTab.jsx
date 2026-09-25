// Variance Alerts — entries where the panel spread exceeds 15 points,
// or a tie-break / admin review is pending.
import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { judgeApi, pickList, pickNum } from '@/lib/judgeApi';
import { PanelLoading, PanelError, PanelEmpty } from '@/components/judge/PanelStates';

const REASON_LABELS = {
  variance: 'High spread',
  tie_break: 'Tie-break pending',
  admin_review: 'Admin review pending',
};

export default function VarianceAlertsTab({ refreshKey }) {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');

  const load = () => {
    setError('');
    judgeApi('judge-variance-alerts')
      .then((d) => setRows(pickList(d, ['alerts', 'rows', 'items'])))
      .catch((e) => setError(e.message));
  };
  useEffect(load, [refreshKey]);

  if (error) return <PanelError message={error} onRetry={load} />;
  if (!rows) return <PanelLoading label="Checking for variance alerts…" />;
  if (!rows.length) return <PanelEmpty message="No variance alerts — the panel is in good agreement." />;

  return (
    <div className="space-y-3">
      {rows.map((r, i) => {
        const spread = pickNum(r, ['spread', 'variance', 'score_spread'], null);
        const reason = (r.reason || (spread !== null && spread > 15 ? 'variance' : 'admin_review')).toString().toLowerCase();
        return (
          <div key={r.id || i} className="flex flex-wrap items-center gap-3 rounded-2xl border border-gold/40 bg-gold/5 p-4">
            <AlertTriangle className="h-5 w-5 shrink-0 text-gold" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{r.entry_title || r.title || 'Entry under review'}</p>
              <p className="text-xs text-muted-foreground">
                {r.challenge_title || r.round_title || ''}
                {spread !== null && ` · panel spread ${spread} points`}
              </p>
            </div>
            <span className="rounded-full bg-gold/15 px-2.5 py-1 text-xs font-semibold text-gold">
              {REASON_LABELS[reason] || REASON_LABELS.admin_review}
            </span>
          </div>
        );
      })}
    </div>
  );
}