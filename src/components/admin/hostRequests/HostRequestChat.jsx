import { useState, useEffect } from 'react';
import { Send, MessageSquare, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { adminChallengeData } from '@/lib/adminChallengeApi';

export default function HostRequestChat({ request, messages: initialMessages = [], onChanged }) {
  const [messages, setMessages] = useState(initialMessages);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => { setMessages(initialMessages); }, [initialMessages]);

  const send = async () => {
    const message = text.trim();
    if (!message) return;
    setSending(true);
    try {
      // Email the applicant directly.
      const emailRes = await base44.integrations.Core.SendEmail({
        to: request.contact_email,
        subject: `Re: Your challenge proposal — ${request.working_title}`,
        body: `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#1c1917"><p>Hi ${request.contact_name},</p><p>${message.replace(/\n/g, '<br>')}</p><p style="color:#78716c;font-size:13px">— The 53 Challenges Team<br>Regarding your "Host a Challenge" request: ${request.working_title}</p></div>`,
      });
      const emailed = !!emailRes;
      // Best-effort: persist the message on the parent via the admin proxy.
      const newMsg = { message, sender: 'admin', emailed, created_date: new Date().toISOString() };
      try {
        const persisted = await adminChallengeData('hostRequests.sendMessage', { id: request.id, message, sender: 'admin' });
        if (persisted?.message) Object.assign(newMsg, persisted.message);
      } catch { /* parent may not support sendMessage — email still went out */ }
      setMessages((prev) => [...prev, newMsg]);
      // Move to 'contacted' if currently 'new'.
      if (request.status === 'new') {
        try { await adminChallengeData('hostRequests.update', { id: request.id, status: 'contacted' }); } catch {}
      }
      setText('');
      onChanged?.();
      toast.success(emailed ? 'Message emailed to applicant' : 'Message saved (email not sent)');
    } catch {
      toast.error('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="border rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <MessageSquare className="w-4 h-4 text-orange-600" />
        <h3 className="font-semibold text-stone-900 text-sm">Conversation with applicant</h3>
      </div>

      <div className="space-y-2 max-h-64 overflow-y-auto mb-3">
        {messages.length === 0 && (
          <p className="text-xs text-stone-400 text-center py-3">No messages yet — send one below, it will be emailed to {request.contact_email}.</p>
        )}
        {messages.map((m, i) => (
          <div key={m.id || i} className={`flex ${m.sender === 'admin' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${m.sender === 'admin' ? 'bg-orange-600 text-white' : 'bg-stone-100 text-stone-800'}`}>
              <p className="whitespace-pre-wrap">{m.message || m.body || m.text}</p>
              <p className={`text-[10px] mt-1 ${m.sender === 'admin' ? 'text-orange-100' : 'text-stone-400'}`}>
                {new Date(m.created_date || m.sent_at).toLocaleString('en-AU')}{m.sender === 'admin' && (m.emailed ? ' · emailed' : ' · not emailed')}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-2 items-end">
        <Textarea
          placeholder="Ask the applicant for further details…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={2}
          className="text-sm"
        />
        <Button onClick={send} disabled={sending || !text.trim()} className="bg-orange-600 hover:bg-orange-700 text-white">
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </Button>
      </div>
    </div>
  );
}