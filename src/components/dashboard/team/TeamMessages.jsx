import { useEffect, useState } from 'react';
import { Loader2, MessageSquare } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { teamMessages } from '@/lib/teamMessages';
import TeamThreadView from '@/components/dashboard/team/TeamThreadView';

/** Team inbox — every participant thread, with unread counts and replies. */
export default function TeamMessages({ onUnreadChange }) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.is_admin === true;
  const [threads, setThreads] = useState([]);
  const [active, setActive] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    try {
      const data = await teamMessages.listThreads();
      setThreads(data?.threads || []);
      onUnreadChange?.(data?.unread_total || 0);
    } catch (e) {
      setError(e?.message || 'Could not load the message inbox.');
    }
  };

  useEffect(() => {
    if (!isAdmin) { setLoading(false); return; }
    (async () => { setLoading(true); await load(); setLoading(false); })();
  }, [isAdmin]);

  if (!isAdmin) {
    return <p className="text-sm text-muted-foreground">Participant messages are available to 53 Challenges administrators only.</p>;
  }

  if (loading) {
    return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      <div className="rounded-2xl border border-border bg-card">
        <div className="flex items-center gap-2 border-b border-border px-5 py-3">
          <MessageSquare className="h-4 w-4 text-primary" />
          <p className="text-sm font-bold">Participant threads</p>
        </div>
        {error && <p className="px-5 py-4 text-sm text-destructive">{error}</p>}
        {threads.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-muted-foreground">No participant messages yet.</p>
        ) : (
          <ul className="max-h-[520px] divide-y divide-border overflow-y-auto">
            {threads.map((t) => (
              <li key={t.participant_email}>
                <button
                  onClick={() => setActive(t)}
                  className={`w-full px-5 py-3 text-left transition-colors hover:bg-muted ${active?.participant_email === t.participant_email ? 'bg-muted' : ''}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-semibold">{t.participant_name || t.participant_email}</p>
                    {t.unread > 0 && (
                      <span data-testid="thread-unread-badge" className="shrink-0 rounded-full bg-primary px-2 py-0.5 text-[11px] font-bold text-primary-foreground">
                        {t.unread} new
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {t.last_sender === 'team' ? 'You: ' : ''}{t.last_body}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        {active ? (
          <TeamThreadView thread={active} onReplied={load} />
        ) : (
          <div className="grid h-full min-h-[220px] place-items-center rounded-2xl border border-border bg-card p-8 text-center">
            <p className="text-sm text-muted-foreground">Select a thread to read and reply.</p>
          </div>
        )}
      </div>
    </div>
  );
}