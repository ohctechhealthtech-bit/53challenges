import { useState } from 'react';
import { Sparkles, Loader2, Copy, Check } from 'lucide-react';
import { aiFollowUpDraft } from '@/lib/marketing';

export default function FollowUpDraft({ inquiryId }) {
  const [draft, setDraft] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const run = async () => {
    setLoading(true); setError('');
    try {
      const d = await aiFollowUpDraft(inquiryId);
      if (d?.error) throw new Error(d.error);
      setDraft(d);
    } catch (e) {
      setError(e?.message || 'Could not draft the follow-up.');
    }
    setLoading(false);
  };

  const copy = async () => {
    await navigator.clipboard.writeText(`Subject: ${draft.subject}\n\n${draft.body}`);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="w-full">
      <button onClick={run} disabled={loading} className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-secondary px-3 py-1.5 text-xs font-semibold hover:border-primary/40 disabled:opacity-60">
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 text-primary" />}
        {loading ? 'Drafting…' : draft ? 'Redraft follow-up' : 'Draft follow-up'}
      </button>
      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
      {draft && (
        <div className="mt-3 rounded-xl border border-border bg-secondary p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Subject</p>
          <p className="mt-1 font-semibold">{draft.subject}</p>
          <p className="mt-3 whitespace-pre-wrap text-sm text-muted-foreground">{draft.body}</p>
          <button onClick={copy} className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:border-primary/40">
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />} {copied ? 'Copied' : 'Copy message'}
          </button>
        </div>
      )}
    </div>
  );
}