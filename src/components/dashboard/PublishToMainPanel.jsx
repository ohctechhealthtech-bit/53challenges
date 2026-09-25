import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Rocket, CheckCircle2 } from 'lucide-react';
import { corporateIntake } from '@/lib/corporateIntake';

/**
 * Publishes an approved intake proposal into the MAIN challenge system
 * (upstream Challenge API). Admin-only surface used from the intake queue.
 */
export default function PublishToMainPanel({ draft, hostName, onPublished }) {
  const [title, setTitle] = useState(draft.challenge_title || `${hostName || ''} Challenge`.trim());
  const [description, setDescription] = useState(draft.challenge_description || '');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [publishedId, setPublishedId] = useState(draft.challenge_id || '');

  const publish = async () => {
    setBusy(true);
    setError('');
    try {
      const res = await corporateIntake.publishToMain({
        draft_id: draft.id, title, description,
        start_date: startDate, end_date: endDate,
      });
      setPublishedId(res.challenge_id);
      onPublished?.(res.challenge_id);
    } catch (e) {
      setError(e.message || 'Publishing failed');
    } finally {
      setBusy(false);
    }
  };

  if (publishedId) {
    return (
      <div className="mt-4 rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm">
        <p className="flex items-center gap-2 font-semibold text-emerald-400"><CheckCircle2 className="h-4 w-4" /> Live in the main challenge system</p>
        <p className="mt-1 text-xs text-muted-foreground">Challenge ID {publishedId}</p>
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-lg border border-border bg-card p-3">
      <p className="flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground"><Rocket className="h-4 w-4 text-primary" /> Publish to main challenge system</p>
      <div className="mt-3 space-y-3">
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Challenge title</label>
          <input className="c53-input" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Description / brief</label>
          <textarea className="c53-input min-h-[80px]" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Starts</label>
            <input type="date" className="c53-input" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Ends</label>
            <input type="date" className="c53-input" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
        </div>
      </div>
      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
      <Button className="mt-3" disabled={busy || !title.trim() || !startDate || !endDate} onClick={publish}>
        {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Rocket className="mr-1 h-4 w-4" />}
        Publish to main system
      </Button>
    </div>
  );
}