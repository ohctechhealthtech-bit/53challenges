/** Drafts the "what you have in mind" text from the host's working title. */
import { useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { base44 } from '@/api/base44Client';

export default function IdeaSuggestButton({ data, onSuggestion }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const ready = data.challenge_title.trim().length >= 3;

  const run = async () => {
    setBusy(true);
    setError('');
    try {
      const res = await base44.functions.invoke('hostChallengeRequest', {
        action: 'suggest_description',
        challenge_title: data.challenge_title,
        activity_type: data.activity_type,
        org_type: data.org_type,
        current_description: data.challenge_description,
      });
      if (res.data?.description) onSuggestion(res.data.description);
      else setError(res.data?.error || "We couldn't write a draft just now — please try again.");
    } catch {
      setError("We couldn't write a draft just now — please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={run}
        disabled={busy || !ready}
        className="inline-flex items-center gap-1.5 rounded-xl border border-primary/40 px-3 py-1.5 text-xs font-bold text-primary transition-colors hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
        {busy ? 'Writing a draft…' : 'Suggest wording for me'}
      </button>
      <p className="mt-1.5 text-xs text-muted-foreground">
        {ready
          ? 'We\u2019ll draft this from your title — you can edit it however you like.'
          : 'Add a challenge title above and we can draft this for you.'}
      </p>
      {error ? <p role="alert" className="mt-1.5 text-xs font-semibold text-destructive">{error}</p> : null}
    </div>
  );
}