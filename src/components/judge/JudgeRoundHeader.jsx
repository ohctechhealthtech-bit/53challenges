// Round selector header: challenge picker, deadline, submitted-by-you count,
// refresh, and the "Judge the reel" action.
import { RefreshCw, CalendarClock, Film } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function JudgeRoundHeader({ rounds = [], roundId, onRound, overview, refreshing, onRefresh, onOpenReel }) {
  const deadline = overview?.next_due_date || overview?.deadline || overview?.judging_deadline || overview?.due_date || '';
  const scored = overview?.scored ?? overview?.entries_scored ?? null;
  const total = overview?.total ?? overview?.entries_total ?? null;
  const submittedLabel = overview?.submitted_label ||
    (scored !== null && total !== null ? `${scored} of ${total} entries submitted by you` : '');

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-4">
      <div className="min-w-[220px] flex-1">
        <label htmlFor="judge-round" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Judging round
        </label>
        <select
          id="judge-round"
          className="c53-input"
          value={roundId}
          onChange={(e) => onRound(e.target.value)}
        >
          {!rounds.length && <option value="">No rounds assigned</option>}
          {rounds.map((r) => {
            const rid = r.round_id || r.id;
            return (
              <option key={rid} value={rid}>{r.title || r.challenge_title || r.name || `Round ${rid}`}</option>
            );
          })}
        </select>
      </div>
      <div className="text-sm">
        {deadline && (
          <p className="flex items-center gap-1.5 text-muted-foreground">
            <CalendarClock className="h-4 w-4" />
            Deadline: <span className="font-semibold text-foreground">{new Date(deadline).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
          </p>
        )}
        {submittedLabel && <p className="mt-1 font-semibold text-foreground">{submittedLabel}</p>}
      </div>
      <div className="ml-auto flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={onRefresh} disabled={refreshing} aria-label="Refresh">
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
        </Button>
        <Button size="sm" onClick={onOpenReel}>
          <Film className="h-4 w-4" /> Judge the reel
        </Button>
      </div>
    </div>
  );
}