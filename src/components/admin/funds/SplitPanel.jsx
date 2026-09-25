import { useEffect, useState } from 'react';
import { Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';

// How each dollar of entry fee is shared between the two pools.
export default function SplitPanel({ split, season, readOnly, onSave }) {
  const [sponsor, setSponsor] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { setSponsor(String(split?.sponsorship_pool_percent ?? '')); }, [split]);

  const locked = readOnly || split?.locked;
  const competition = Number.isFinite(Number(sponsor)) ? 100 - Number(sponsor) : '';

  const submit = async (e) => {
    e.preventDefault();
    const s = Number(sponsor);
    if (!Number.isFinite(s) || s < 0 || s > 100) { setError('Enter a share between 0 and 100.'); return; }
    setSaving(true);
    setError('');
    try {
      await onSave({ season, sponsorshipPoolPercent: s, competitionFundPercent: 100 - s });
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="rounded-2xl border border-border bg-card/60 p-5">
      <h3 className="font-heading text-base font-bold">How entry fees are shared</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Applies to every challenge in this season{split?.season_challenges ? ` (${split.season_challenges})` : ''}.
      </p>

      {split?.locked && (
        <p className="mt-3 flex items-start gap-2 rounded-xl border border-gold/30 bg-gold/10 px-3 py-2 text-sm">
          <Lock className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
          <span>{split.lock_reason || 'The share is locked now that the season has opened.'}</span>
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <div className="w-[180px]">
          <label htmlFor="split-sponsor" className="mb-1.5 block text-sm font-semibold">Sponsorship pool (%)</label>
          <input
            id="split-sponsor"
            className="c53-input"
            inputMode="numeric"
            value={sponsor}
            disabled={locked}
            onChange={(e) => { setSponsor(e.target.value); setError(''); }}
          />
        </div>
        <div className="w-[180px]">
          <label htmlFor="split-competition" className="mb-1.5 block text-sm font-semibold">Competition fund (%)</label>
          <input id="split-competition" className="c53-input" value={competition} disabled readOnly />
        </div>
        <Button type="submit" disabled={saving || locked}>{saving ? 'Saving…' : 'Save share'}</Button>
      </div>
      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
    </form>
  );
}