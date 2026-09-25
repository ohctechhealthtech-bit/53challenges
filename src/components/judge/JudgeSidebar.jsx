// Left sidebar: judge identity + tab navigation with live counts.
import { ClipboardList, Images, Film, Users, AlertTriangle, Trophy, BookOpen } from 'lucide-react';

const NAV = [
  { key: 'assignments', label: 'Assignments', icon: ClipboardList, countKey: 'assignments' },
  { key: 'entries', label: 'Entries', icon: Images, countKey: 'remaining' },
  { key: 'reel', label: 'Judge the reel', icon: Film },
  { key: 'panel', label: 'Panel Progress', icon: Users },
  { key: 'variance', label: 'Variance Alerts', icon: AlertTriangle, countKey: 'alerts' },
  { key: 'results', label: 'Results', icon: Trophy },
  { key: 'policies', label: 'Policies', icon: BookOpen },
];

export default function JudgeSidebar({ judge, tab, onTab, onOpenReel, counts = {} }) {
  return (
    <aside className="w-full shrink-0 lg:w-60">
      <div className="rounded-2xl border border-border bg-card p-4">
        <p className="font-heading text-sm font-bold">{judge?.name || judge?.full_name || 'Judge'}</p>
        <p className="mt-0.5 text-xs capitalize text-muted-foreground">
          {(judge?.level || judge?.judge_level || 'panel').toString().replace(/[_-]/g, ' ')} judge
        </p>
      </div>
      <nav className="mt-3 flex gap-1 overflow-x-auto scrollbar-hide lg:flex-col lg:overflow-visible" aria-label="Judging sections">
        {NAV.map((item) => {
          const Icon = item.icon;
          const active = tab === item.key;
          const count = item.countKey != null ? counts[item.countKey] : null;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => (item.key === 'reel' ? onOpenReel() : onTab(item.key))}
              aria-current={active ? 'page' : undefined}
              className={`flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-sm transition lg:w-full ${
                active ? 'bg-primary text-primary-foreground' : 'text-foreground/80 hover:bg-secondary'
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="flex-1 whitespace-nowrap text-left">{item.label}</span>
              {typeof count === 'number' && (
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${active ? 'bg-white/20' : 'bg-secondary text-muted-foreground'}`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}