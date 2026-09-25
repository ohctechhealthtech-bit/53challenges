// Overview stat cards: assignments, entries remaining, scored, next due.
import { Trophy, ClipboardList, CheckCircle2, CalendarDays } from 'lucide-react';
import { pickNum } from '@/lib/judgeApi';

const daysUntil = (date) => {
  if (!date) return null;
  const diff = Math.ceil((new Date(date) - new Date()) / 86400000);
  return isNaN(diff) ? null : diff;
};

function StatCard({ icon: Icon, tone, value, label, small }) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4">
      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${tone}`}>
        <Icon className="h-6 w-6" />
      </div>
      <div className="min-w-0">
        {small && <p className="text-xs font-medium text-muted-foreground">{small}</p>}
        <p className="font-heading text-2xl font-bold leading-tight">{value}</p>
        <p className="text-sm text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

export default function JudgeKpiCards({ overview }) {
  const o = overview || {};
  const scored = pickNum(o, ['scored', 'entries_scored'], 0);
  const total = pickNum(o, ['total', 'entries_total'], 0);
  const assignments = pickNum(o, ['active_assignments', 'assignments', 'assignment_count'], 0);
  const remaining = pickNum(o, ['entries_remaining', 'remaining'], Math.max(total - scored, 0));
  const deadline = o.deadline || o.judging_deadline || o.due_date;
  const days = daysUntil(deadline);

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard icon={Trophy} tone="bg-primary/15 text-primary" value={assignments} label="Active Assignments" />
      <StatCard icon={ClipboardList} tone="bg-gold/15 text-gold" value={remaining} label="Entries Remaining" />
      <StatCard icon={CheckCircle2} tone="bg-success/15 text-success" value={scored} label={`Scored of ${total}`} />
      <StatCard
        icon={CalendarDays}
        tone="bg-destructive/15 text-destructive"
        small="Next Due"
        value={days == null ? '—' : days < 0 ? 'Closed' : days === 0 ? 'Today' : `${days} Days`}
        label={deadline ? new Date(deadline).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }) : 'No deadline set'}
      />
    </div>
  );
}