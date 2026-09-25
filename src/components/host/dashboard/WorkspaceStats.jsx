/**
 * Live challenge stats for the host (hostPortal 'dashboard' action).
 */
import { useEffect, useState } from 'react';
import { Loader2, FileText, Heart, Eye, Rocket } from 'lucide-react';
import { hostPortal } from '@/lib/hostPortalClient';

const CARDS = [
  { key: 'live_challenges', label: 'Live challenges', icon: Rocket },
  { key: 'entries', label: 'Entries', icon: FileText },
  { key: 'votes', label: 'Votes', icon: Heart },
  { key: 'pending_review', label: 'Awaiting review', icon: Eye },
];

export default function WorkspaceStats() {
  const [data, setData] = useState(null);

  useEffect(() => {
    let active = true;
    hostPortal('dashboard').then((d) => { if (active) setData(d); }).catch(() => { if (active) setData({ stats: {} }); });
    return () => { active = false; };
  }, []);

  if (!data) {
    return (
      <div className="flex items-center justify-center rounded-2xl border border-border bg-card py-10">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }

  const stats = data.stats || {};
  const recent = data.recent_entries || [];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {CARDS.map(({ key, label, icon: Icon }) => (
          <div key={key} className="rounded-2xl border border-border bg-card p-4">
            <Icon className="mb-2 h-4 w-4 text-primary" aria-hidden="true" />
            <p className="font-heading text-2xl font-extrabold">{stats[key] ?? 0}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>
      {recent.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Recent entries</p>
          <ul className="divide-y divide-border">
            {recent.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="min-w-0 truncate">
                  <span className="font-semibold">{e.title}</span>
                  <span className="text-muted-foreground"> — {e.creator_name}</span>
                </span>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                  e.status === 'approved' ? 'bg-emerald-500/15 text-emerald-300' : e.status === 'rejected' ? 'bg-destructive/15 text-destructive' : 'bg-amber-500/15 text-amber-300'
                }`}>
                  {e.status === 'approved' ? 'Approved' : e.status === 'rejected' ? 'Not approved' : 'In review'}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}