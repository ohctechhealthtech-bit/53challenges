/**
 * Messages tab — conversations with the 53 Challenges team.
 */
import { Link } from 'react-router-dom';
import { MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function MessagesTab({ notifications }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <p className="mb-4 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <MessageSquare className="h-3.5 w-3.5" /> Messages from our team
      </p>
      {notifications.length === 0 ? (
        <p className="text-sm text-muted-foreground">No messages yet — we'll write here when there's news.</p>
      ) : (
        <ul className="space-y-3">
          {notifications.map((n) => (
            <li key={n.id} className="rounded-xl border border-border p-3">
              <p className="text-sm font-semibold">{n.title}</p>
              {n.body && <p className="mt-0.5 text-sm text-muted-foreground">{n.body}</p>}
              <p className="mt-1 text-[10px] text-muted-foreground">
                {new Date(n.created_date).toLocaleString('en-AU', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
              </p>
            </li>
          ))}
        </ul>
      )}
      <Button asChild variant="outline" className="mt-4">
        <Link to="/contact-us">Message our team</Link>
      </Button>
    </div>
  );
}