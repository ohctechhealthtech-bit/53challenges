import { safeExternalUrl } from '@/lib/safeUrl';
import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { getSessionToken } from '@/lib/appSession';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Send, RefreshCw, CheckCircle2, Clock, XCircle, FileText, Sparkles } from 'lucide-react';

const STATUS_STYLE = {
  none: 'bg-stone-100 text-stone-600',
  pending: 'bg-amber-100 text-amber-700',
  paid: 'bg-emerald-100 text-emerald-700',
  expired: 'bg-rose-100 text-rose-700',
};
const STATUS_LABEL = { none: 'No quote sent', pending: 'Awaiting payment', paid: 'Paid', expired: 'Link expired' };
const STATUS_ICON = { none: FileText, pending: Clock, paid: CheckCircle2, expired: XCircle };

export default function HostRequestQuotePanel({ request, onChanged }) {
  const [amount, setAmount] = useState(request.quote_amount ? String(request.quote_amount) : '');
  const [notes, setNotes] = useState(request.quote_notes || '');
  const [busy, setBusy] = useState('');
  const [status, setStatus] = useState(request.payment_status || 'none');
  const [aiNote, setAiNote] = useState('');

  const StatusIcon = STATUS_ICON[status] || FileText;

  const aiEstimate = async () => {
    setBusy('ai');
    setAiNote('');
    try {
      const ctx = [
        `Working title: ${request.working_title || '—'}`,
        `Company: ${request.company_name || '—'}`,
        `Industry: ${request.industry || '—'}`,
        `Challenge type: ${request.challenge_type || '—'}`,
        `Description: ${request.description || '—'}`,
        `Main goal: ${request.main_goal || '—'}`,
        `Participants: ${request.participants || '—'}`,
        `Expected participants: ${request.expected_participants || '—'}`,
        `Geographic scope: ${request.geographic_scope || '—'}`,
        `Launch timeframe: ${request.launch_timeframe || '—'}`,
        `Budget range: ${request.budget_range || '—'}`,
        `Prize format: ${request.prize_format || '—'}`,
        `Additional notes: ${request.additional_notes || '—'}`,
      ].join('\n');
      const res = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a pricing specialist for "53 Challenges", an Australian creative-challenge platform that runs hosted creative challenges for organisations. Estimate a fair hosting quote in AUD (ex-GST) for this enquiry.\n\nEnquiry details:\n${ctx}\n\nTypical platform pricing reference: self-serve challenges start around $1,500–$3,000; assisted/managed challenges $4,000–$12,000; large national or enterprise campaigns $15,000+. Add for extra participants, longer runs, public voting, prize administration, marketing boost.\n\nReturn a recommended quote amount (number, AUD ex-GST), a short notes line describing what the quote covers, and a one-line reasoning. Be conservative and realistic.`,
        response_json_schema: {
          type: 'object',
          properties: {
            amount: { type: 'number' },
            notes: { type: 'string' },
            reasoning: { type: 'string' },
          },
          required: ['amount', 'notes'],
        },
      });
      const data = typeof res === 'string' ? JSON.parse(res) : res;
      if (data?.amount) setAmount(String(Number(data.amount).toFixed(2)));
      if (data?.notes) setNotes(data.notes);
      setAiNote(data?.reasoning || '');
      toast.success('AI estimate ready — review before sending');
    } catch (e) {
      toast.error(e?.message || 'AI estimate failed');
    } finally {
      setBusy('');
    }
  };

  const send = async () => {
    const amt = Number(amount);
    if (!amt || amt <= 0) { toast.error('Enter a valid quote amount'); return; }
    setBusy('send');
    try {
      const res = await base44.functions.invoke('hostRequestQuote', {
        action: 'send_quote',
        session_token: getSessionToken(),
        request_id: request.id,
        amount: amt,
        notes,
      });
      setStatus('pending');
      toast.success(`Quote sent to ${request.contact_email}`);
      onChanged?.();
      return res.data;
    } catch (e) {
      toast.error(e?.message || 'Failed to send quote');
    } finally {
      setBusy('');
    }
  };

  const refresh = async () => {
    setBusy('refresh');
    try {
      const res = await base44.functions.invoke('hostRequestQuote', {
        action: 'check_status',
        session_token: getSessionToken(),
        request_id: request.id,
      });
      setStatus(res.data?.payment_status || status);
      onChanged?.();
    } catch (e) {
      toast.error('Could not refresh payment status');
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="border rounded-lg p-4 bg-white space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="font-semibold text-sm flex items-center gap-2"><FileText className="w-4 h-4" /> Quote & Payment Link</h3>
        <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_STYLE[status]}`}>
          <StatusIcon className="w-3.5 h-3.5" /> {STATUS_LABEL[status]}
        </span>
      </div>

      <div className="grid sm:grid-cols-[140px_1fr] gap-2 items-start">
        <div>
          <label className="text-xs font-medium text-stone-500">Quote amount (AUD)</label>
          <Input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" className="h-9" />
          <Button size="sm" variant="outline" onClick={aiEstimate} disabled={busy === 'ai'} className="mt-1.5 gap-1.5 text-xs w-full">
            <Sparkles className={`w-3.5 h-3.5 ${busy === 'ai' ? 'animate-spin' : ''}`} /> {busy === 'ai' ? 'Estimating…' : 'AI estimate'}
          </Button>
        </div>
        <div>
          <label className="text-xs font-medium text-stone-500">Notes / inclusions (optional)</label>
          <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Self-serve package, 4-week run, public voting…" />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={send} disabled={busy === 'send'} className="gap-2 bg-orange-600 hover:bg-orange-700 text-white">
          <Send className="w-4 h-4" /> {request.payment_link_url ? 'Resend quote & link' : 'Send quote & payment link'}
        </Button>
        {request.payment_link_url && (
          <Button size="sm" variant="outline" onClick={refresh} disabled={busy === 'refresh'} className="gap-2">
            <RefreshCw className={`w-4 h-4 ${busy === 'refresh' ? 'animate-spin' : ''}`} /> Refresh payment status
          </Button>
        )}
      </div>

      {request.payment_link_url && (
        <div className="text-xs text-stone-500 space-y-1 border-t pt-2">
          <p><span className="font-medium text-stone-600">Sent:</span> {request.quote_sent_at ? new Date(request.quote_sent_at).toLocaleString('en-AU') : '—'}</p>
          <p><span className="font-medium text-stone-600">Link expires:</span> {request.payment_link_expires_at ? new Date(request.payment_link_expires_at).toLocaleString('en-AU') : '—'}</p>
          {status === 'paid' && request.payment_paid_at && (
            <p className="text-emerald-600 font-medium"><CheckCircle2 className="w-3.5 h-3.5 inline" /> Paid on {new Date(request.payment_paid_at).toLocaleString('en-AU')}</p>
          )}
          <p className="break-all"><span className="font-medium text-stone-600">Payment link:</span> <a href={safeExternalUrl(request.payment_link_url)} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">{request.payment_link_url}</a></p>
        </div>
      )}

      {aiNote && (
        <p className="text-[11px] text-stone-500 bg-stone-50 border rounded p-2"><span className="font-medium text-stone-600">AI reasoning:</span> {aiNote}</p>
      )}

      <p className="text-[11px] text-stone-400">The payment link expires 24 hours after sending. Edit the amount and resend any time — a fresh link replaces the old one.</p>
    </div>
  );
}