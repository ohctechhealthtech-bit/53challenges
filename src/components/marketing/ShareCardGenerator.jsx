import { useState } from 'react';
import { Loader2, Image as ImageIcon, Copy, Check, AlertTriangle } from 'lucide-react';
import { Image } from '@/components/ui/image';
import { generateShareCard } from '@/lib/marketing';

export default function ShareCardGenerator() {
  const [mode, setMode] = useState('entry');
  const [f, setF] = useState({ title: '', creator: '', votes: '', theme: '', challenge: '' });
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const gen = async () => {
    setBusy(true);
    setUrl('');
    setError('');
    try {
      const d = await generateShareCard({ mode, ...f });
      if (d?.error) throw new Error(d.error);
      setUrl(d.url || '');
      if (!d.url) throw new Error('Image generation returned no image — please try again.');
    } catch (e) {
      setError(e?.message || 'Could not generate the share card. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    await navigator.clipboard?.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };

  return (
    <div className="max-w-2xl space-y-5">
      <div><h2 className="font-heading text-xl font-bold">Social share cards</h2><p className="text-sm text-muted-foreground">Auto-generate a shareable card per entry or per competition. Generated securely on the server.</p></div>
      <div className="flex gap-2">
        {[['entry', 'Per entry'], ['competition', 'Per competition']].map(([v, l]) => (
          <button key={v} onClick={() => setMode(v)} className={`rounded-xl px-4 py-2 text-sm font-semibold ${mode === v ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>{l}</button>
        ))}
      </div>
      <div className="grid gap-4">
        {mode === 'entry' ? (
          <>
            <input className="c53-input" placeholder="Entry title" value={f.title} onChange={(e) => setF((s) => ({ ...s, title: e.target.value }))} />
            <input className="c53-input" placeholder="Creator name" value={f.creator} onChange={(e) => setF((s) => ({ ...s, creator: e.target.value }))} />
            <input className="c53-input" placeholder="Vote count" value={f.votes} onChange={(e) => setF((s) => ({ ...s, votes: e.target.value }))} />
          </>
        ) : (
          <>
            <input className="c53-input" placeholder="Competition name" value={f.challenge} onChange={(e) => setF((s) => ({ ...s, challenge: e.target.value }))} />
            <input className="c53-input" placeholder="Theme" value={f.theme} onChange={(e) => setF((s) => ({ ...s, theme: e.target.value }))} />
          </>
        )}
        <button onClick={gen} disabled={busy} className="inline-flex items-center gap-2 rounded-xl grad-bg px-5 py-2.5 text-sm font-bold text-white">
          {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Generating…</> : <><ImageIcon className="h-4 w-4" /> Generate card</>}
        </button>
      </div>
      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}
      {url && (
        <div className="space-y-2">
          <Image src={url} alt="Generated share card" className="w-full max-w-xs overflow-hidden rounded-2xl border border-border" fittingType="fit" />
          <div className="flex items-center gap-2 text-sm">
            <span className="truncate text-muted-foreground">{url}</span>
            <button onClick={copy} aria-label="Copy image URL" className="shrink-0 text-primary">{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}</button>
          </div>
        </div>
      )}
    </div>
  );
}