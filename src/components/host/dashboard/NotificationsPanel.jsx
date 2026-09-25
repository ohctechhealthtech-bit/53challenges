/**
 * Host notifications with a "mark all read" action.
 */
import { useState } from 'react';
import { Bell, CheckCheck, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { hostPortal } from '@/lib/hostPortalClient';

export default function NotificationsPanel({ notifications, onChanged }) {
  const [marking, setMarking] = useState(false);
  const unread = notifications.filter((n) => !n.read).length;

  const markAll = async () => {
    setMarking(true);
    try {
      await hostPortal('mark_notifications_read');
      await onChanged();
    } finally {
      setMarking(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <Bell className="h-3.5 w-3.5" /> Notifications
          {unread > 0 && <span className="rounded-full bg-primary px-1.5 text-[10px] font-bold text-white">{unread}</span>}
        </p>
        {unread > 0 && (
          <Button variant="ghost" size="sm" onClick={markAll} disabled={marking} className="h-7 text-xs">
            {marking ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <CheckCheck className="mr-1 h-3 w-3" />}
            Mark all read
          </Button>
        )}
      </div>
      {notifications.length === 0 ? (
        <p className="py-2 text-sm text-muted-foreground">Nothing new right now.</p>
      ) : (
        <ul className="max-h-64 space-y-2 overflow-y-auto pr-1">
          {notifications.map((n) => (
            <li key={n.id} className={`rounded-xl border px-3 py-2 ${n.read ? 'border-border' : 'border-primary/40 bg-primary/5'}`}>
              <p className="text-sm font-semibold">{n.title}</p>
              {n.body && <p className="mt-0.5 text-xs text-muted-foreground">{n.body}</p>}
              <p className="mt-1 text-[10px] text-muted-foreground">
                {new Date(n.created_date).toLocaleString('en-AU', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}