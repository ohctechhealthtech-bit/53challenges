import { Flame } from 'lucide-react';

export default function StreakCard({ current = 0, longest = 0, activeWeeks = 0 }) {
  const alive = current > 0;
  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="flex items-center gap-4">
        <div className={`grid h-14 w-14 shrink-0 place-items-center rounded-2xl ${alive ? 'grad-bg' : 'bg-muted'}`}>
          <Flame className={`h-7 w-7 ${alive ? 'text-white' : 'text-muted-foreground'}`} aria-hidden="true" />
        </div>
        <div>
          <p className="font-heading text-3xl font-extrabold leading-none">
            {current} <span className="text-base font-bold text-muted-foreground">week{current === 1 ? '' : 's'}</span>
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {alive ? 'Current streak — keep it going' : 'No active streak — submit this week to start one'}
          </p>
        </div>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3 border-t border-border pt-4 text-sm">
        <div>
          <p className="font-heading text-lg font-bold">{longest}</p>
          <p className="text-muted-foreground">Longest streak</p>
        </div>
        <div>
          <p className="font-heading text-lg font-bold">{activeWeeks}</p>
          <p className="text-muted-foreground">Active weeks</p>
        </div>
      </div>
    </div>
  );
}