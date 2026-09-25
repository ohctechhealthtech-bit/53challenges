import { useEffect, useState } from 'react';
import { Loader2, Send, MessageSquare } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { teamMessages } from '@/lib/teamMessages';

const BLUE = '#2e5bff';

function fmt(d) {
  if (!d) return '';
  try {
    return new Date(d).toLocaleString('en-AU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  } catch { return d; }
}

/** Messages tab — a direct thread between the participant and the 53 Challenges team. */
export default function MessagesTab({ onRead }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    const list = await base44.entities.Message.list('created_date', 200).catch(() => []);
    setMessages(list || []);
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      // Opening the thread clears the "new reply" indicator.
      await teamMessages.markRead().catch(() => null);
      await load();
      setLoading(false);
      onRead?.();
    })();
  }, []);

  const send = async () => {
    const text = body.trim();
    if (!text) return;
    setSending(true);
    setError('');
    try {
      await base44.entities.Message.create({
        body: text,
        sender: 'user',
        participant_email: user?.email || '',
        participant_name: user?.full_name || '',
        read: false,
      });
      setBody('');
      await load();
    } catch (e) {
      setError(e?.message || "Couldn't send your message — please try again.");
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-3">
          <MessageSquare className="h-4 w-4" style={{ color: BLUE }} />
          <p className="text-sm font-bold text-slate-900">53 Challenges team</p>
        </div>

        <div className="max-h-[420px] space-y-3 overflow-y-auto p-5">
          {messages.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">
              No messages yet. Ask us anything about your entries, classes or judging.
            </p>
          ) : (
            messages.map((m) => {
              const mine = m.sender !== 'team';
              return (
                <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                      mine ? 'text-white' : 'bg-slate-100 text-slate-800'
                    }`}
                    style={mine ? { backgroundColor: BLUE } : undefined}
                  >
                    <p className="whitespace-pre-wrap">{m.body}</p>
                    <p className={`mt-1 text-[11px] ${mine ? 'text-white/70' : 'text-slate-500'}`}>{fmt(m.created_date)}</p>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="border-t border-slate-100 p-4">
          {error && <p className="mb-2 text-sm text-rose-600">{error}</p>}
          <div className="flex items-end gap-2">
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={2}
              placeholder="Write a message…"
              className="flex-1 resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400"
            />
            <button
              onClick={send}
              disabled={sending || !body.trim()}
              className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
              style={{ backgroundColor: BLUE }}
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}