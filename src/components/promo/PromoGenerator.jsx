import { useEffect, useState } from 'react';
import { Sparkles, Loader2, Save } from 'lucide-react';
import { Image } from '@/components/ui/image';
import { generatePost, savePost, myPromoEntries, PROMO_PLATFORMS, PROMO_TONES } from '@/lib/participantPromo';

export default function PromoGenerator({ onSaved, initialEntryId = '', initialTopic = '' }) {
  const [entries, setEntries] = useState([]);
  const [form, setForm] = useState({ entry_id: initialEntryId, topic: initialTopic, tone: 'friendly', platforms: ['instagram'], generate_image: false });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { myPromoEntries().then((d) => setEntries(d?.entries || [])).catch(() => {}); }, []);

  const toggle = (k) => setForm((f) => ({ ...f, platforms: f.platforms.includes(k) ? f.platforms.filter((x) => x !== k) : [...f.platforms, k] }));

  const run = async () => {
    setLoading(true); setError(''); setResult(null);
    try {
      const d = await generatePost(form);
      if (d?.error) throw new Error(d.error);
      setResult(d);
    } catch (e) { setError(e?.message || 'Could not generate the post.'); }
    setLoading(false);
  };

  const save = async () => {
    setSaving(true);
    const entry = entries.find((e) => e.id === form.entry_id);
    await savePost({ ...form, ...result, challenge_title: entry?.challenge_title || '' });
    setSaving(false); setResult(null); onSaved?.();
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-4 rounded-2xl border border-border bg-card p-5">
        <h2 className="font-heading text-xl font-bold">Create a promo post</h2>
        <label className="block text-sm"><span className="mb-1.5 block font-medium">Promote one of your entries</span>
          <select className="c53-input" value={form.entry_id} onChange={(e) => setForm((f) => ({ ...f, entry_id: e.target.value }))}>
            <option value="">No entry — just a general post</option>
            {entries.map((e) => <option key={e.id} value={e.id}>{e.title} {e.challenge_title ? `· ${e.challenge_title}` : ''}</option>)}
          </select>
        </label>
        <label className="block text-sm"><span className="mb-1.5 block font-medium">What do you want to say?</span>
          <textarea rows={3} className="c53-input" placeholder="e.g. Ask my followers to vote for my photo before Friday" value={form.topic} onChange={(e) => setForm((f) => ({ ...f, topic: e.target.value }))} />
        </label>
        <div className="text-sm">
          <span className="mb-1.5 block font-medium">Tone</span>
          <div className="flex flex-wrap gap-2">
            {PROMO_TONES.map((t) => (
              <button key={t} type="button" onClick={() => setForm((f) => ({ ...f, tone: t }))} className={`rounded-full px-3 py-1.5 text-xs font-semibold capitalize ${form.tone === t ? 'grad-bg text-white' : 'border border-border bg-secondary text-muted-foreground'}`}>{t}</button>
            ))}
          </div>
        </div>
        <div className="text-sm">
          <span className="mb-1.5 block font-medium">Platforms</span>
          <div className="flex flex-wrap gap-2">
            {PROMO_PLATFORMS.map((p) => (
              <button key={p.k} type="button" onClick={() => toggle(p.k)} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${form.platforms.includes(p.k) ? 'grad-bg text-white' : 'border border-border bg-secondary text-muted-foreground'}`}>{p.l} <span className="opacity-70">· {p.limit}</span></button>
            ))}
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.generate_image} onChange={(e) => setForm((f) => ({ ...f, generate_image: e.target.checked }))} /> Also generate a matching image</label>
        <button onClick={run} disabled={loading} className="inline-flex w-full items-center justify-center gap-2 rounded-xl grad-bg px-5 py-3 text-sm font-bold text-white disabled:opacity-60">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} {loading ? 'Writing your post…' : 'Generate post'}
        </button>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <h2 className="font-heading text-xl font-bold">Preview</h2>
        {!result && <p className="mt-2 text-sm text-muted-foreground">Your generated post will appear here, ready to edit before you save it.</p>}
        {result && (
          <div className="mt-4 space-y-3">
            {result.image_url && <Image src={result.image_url} alt="Generated promo" className="h-48 w-full rounded-xl" />}
            <textarea rows={8} className="c53-input text-sm" value={result.content} onChange={(e) => setResult((r) => ({ ...r, content: e.target.value }))} />
            <input className="c53-input text-sm" value={(result.hashtags || []).join(', ')} onChange={(e) => setResult((r) => ({ ...r, hashtags: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) }))} />
            <div className="flex gap-2">
              <button onClick={save} disabled={saving} className="inline-flex items-center gap-1.5 rounded-xl grad-bg px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"><Save className="h-4 w-4" /> {saving ? 'Saving…' : 'Save to my posts'}</button>
              <button onClick={run} disabled={loading} className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold hover:border-primary/40">Regenerate</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}