import { useEffect, useState } from 'react';
import { Loader2, Send } from 'lucide-react';
import { teamMessages } from '@/lib/teamMessages';

function fmt(d) {
  if (!d) return '';
  try {
    return new Date(d).toLocaleString('en-AU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  } catch { return d; }
}

/** One participant's thread with a reply box for the team. */
export default function TeamThreadView({ thread, onReplied }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    const data = await teamMessages.getThread(thread.participant_email);
    setMessages(data?.messages || []);
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError('');
      try { await load(); } catch (e) { setError(e?.message || 'Could not load this thread.'); }
      setLoading(false);
      onReplied?.();
    })();
  }, [thread.participant_email]);

  const send = async () => {
    const text = body.trim();
    if (!text) return;
    setSending(true);
    setError('');
    try {
      await teamMessages.reply(thread.participant_email, text, thread.participant_name);
      setBody('');
      await load();
      onReplied?.();
    } catch (e) {
      setError(e?.message || "Couldn't send the reply — please try again.");
    }
    setSending(false);
  };

  return (
    <div className="rounded-2xl border border-border bg-card">
      <div className="border-b border-border px-5 py-3">
        <p className="text-sm font-bold">{thread.participant_name || thread.participant_email}</p>
        <p className="text-xs text-muted-foreground">{thread.participant_email}</p>
      </div>

      <div className="max-h-[420px] space-y-3 overflow-y-auto p-5" data-testid="team-thread-messages">
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
        ) : messages.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No messages in this thread.</p>
        ) : (
          messages.map((m) => {
            const fromTeam = m.sender === 'team';
            return (
              <div key={m.id} className={`flex ${fromTeam ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${fromTeam ? 'grad-bg text-white' : 'bg-muted text-foreground'}`}>
                  <p className="whitespace-pre-wrap">{m.body}</p>
                  <p className={`mt-1 text-[11px] ${fromTeam ? 'text-white/70' : 'text-muted-foreground'}`}>
                    {fromTeam ? 'Team' : 'Participant'} · {fmt(m.created_date)}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="border-t border-border p-4">
        {error && <p className="mb-2 text-sm text-destructive">{error}</p>}
        <div className="flex items-end gap-2">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={2}
            placeholder="Write a reply…"
            className="c53-input flex-1 resize-none"
          />
          <button
            onClick={send}
            disabled={sending || !body.trim()}
            className="inline-flex items-center gap-1.5 rounded-xl grad-bg px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Reply
          </button>
        </div>
      </div>
    </div>
  );
}