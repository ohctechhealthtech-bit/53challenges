/** Live status of a published challenge, straight from the main 53 site. */
import { CalendarDays, Users, Vote } from 'lucide-react';

const STATUS_LABELS = {
  active: { label: 'Live — open for entries', tone: 'bg-emerald-500/15 text-emerald-300' },
  upcoming: { label: 'Scheduled', tone: 'bg-sky-500/15 text-sky-300' },
  voting: { label: 'Voting open', tone: 'bg-violet-500/15 text-violet-300' },
  closed: { label: 'Closed', tone: 'bg-secondary text-muted-foreground' },
  completed: { label: 'Completed', tone: 'bg-secondary text-muted-foreground' },
  draft: { label: 'Being prepared', tone: 'bg-amber-500/15 text-amber-300' },
};

const fmt = (d) => (d ? new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');

export default function ChallengeLiveStatus({ challenge }) {
  if (!challenge) return null;
  const s = STATUS_LABELS[challenge.status] || { label: challenge.status || 'Live', tone: 'bg-secondary text-muted-foreground' };

  return (
    <div className="mt-4 rounded-xl border border-border bg-secondary/40 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Your live challenge</span>
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${s.tone}`}>{s.label}</span>
      </div>
      <div className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
        <p className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span>{fmt(challenge.start_date)} – {fmt(challenge.end_date)}</span>
        </p>
        <p className="flex items-center gap-2">
          <Users className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span>{challenge.submission_count ?? 0} entries</span>
        </p>
        <p className="flex items-center gap-2">
          <Vote className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span>{challenge.total_votes ?? 0} votes</span>
        </p>
      </div>
    </div>
  );
}