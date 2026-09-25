import { useEffect, useRef, useState } from 'react';
import { Send, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import MessageBubble from './MessageBubble';

export default function AgentChat({ agentName, greeting }) {
  const { user } = useAuth();
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    let unsub = () => {};
    (async () => {
      try {
        const conv = await base44.agents.createConversation({ agent_name: agentName, metadata: { name: `${agentName} planning` } });
        setConversation(conv);
        setMessages(conv.messages || []);
        unsub = base44.agents.subscribeToConversation(conv.id, (data) => setMessages(data.messages || []));
      } catch (e) {
        // ignore — chat unavailable
      }
    })();
    return () => unsub();
  }, [agentName]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const send = async (e) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || !conversation || busy) return;
    setInput('');
    setBusy(true);
    try {
      await base44.agents.addMessage(conversation, { role: 'user', content: text });
    } catch (err) {
      // ignore
    } finally {
      setBusy(false);
    }
  };

  const visible = messages.filter((m) => m.content || (m.tool_calls && m.tool_calls.length));

  return (
    <div className="flex h-[68vh] flex-col rounded-2xl border border-border bg-card/60">
      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-5">
        {visible.length === 0 && greeting && (
          <div className="text-sm text-muted-foreground">{greeting}</div>
        )}
        {visible.map((m, i) => (
          <MessageBubble key={i} message={m} userName={user?.full_name} />
        ))}
        {busy && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Ty is thinking…
          </div>
        )}
      </div>
      <form onSubmit={send} className="border-t border-border p-4">
        <div className="flex gap-2">
          <input
            className="c53-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask Ty to plan or refine a challenge…"
          />
          <button type="submit" disabled={busy || !input.trim()} className="btn-bounce inline-flex shrink-0 items-center gap-2 rounded-xl grad-bg px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">
            <Send className="h-4 w-4" />
          </button>
        </div>
      </form>
    </div>
  );
}