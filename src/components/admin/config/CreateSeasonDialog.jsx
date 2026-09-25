import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { adminChallengeApi } from '@/lib/adminChallengeApi';

const DATE_FIELDS = [
  ['state_start', 'State rounds start'],
  ['state_end', 'State rounds end'],
  ['national_start', 'National finals start'],
  ['national_end', 'National finals end'],
  ['grand_start', 'Grand final starts'],
  ['grand_end', 'Grand final ends'],
];

export default function CreateSeasonDialog({ open, onOpenChange, categories, actingEmail, onCreated }) {
  const [form, setForm] = useState({
    season: String(new Date().getFullYear() + 1),
    categories: [],
    top_n_advance: 1,
    state_start: '', state_end: '', national_start: '', national_end: '', grand_start: '', grand_end: '',
  });
  const [plan, setPlan] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (k, v) => { setForm({ ...form, [k]: v }); setPlan(null); };
  const toggleCategory = (value) =>
    set('categories', form.categories.includes(value) ? form.categories.filter((c) => c !== value) : [...form.categories, value]);

  const validate = () => {
    if (!form.season.trim()) return 'Give the season a name.';
    if (form.categories.length === 0) return 'Pick at least one category.';
    for (const [k, label] of DATE_FIELDS) if (!form[k]) return `Set the ${label.toLowerCase()} date.`;
    return '';
  };

  const params = () => ({
    season: form.season.trim(),
    categories: form.categories,
    top_n_advance: Number(form.top_n_advance) || 1,
    state_start: form.state_start, state_end: form.state_end,
    national_start: form.national_start, national_end: form.national_end,
    grand_start: form.grand_start, grand_end: form.grand_end,
    actingEmail,
  });

  const run = async (fn) => {
    const v = validate();
    if (v) { setError(v); return; }
    setBusy(true);
    setError('');
    try { await fn(); } catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  const preview = () => run(async () => setPlan(await adminChallengeApi.configPreviewSeason(params())));
  const create = () => run(async () => {
    await adminChallengeApi.configCreateSeason({ ...params(), ...(plan?.plan ? { challenges: plan.plan } : {}) });
    onCreated();
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create a season</DialogTitle>
          <DialogDescription>
            One state round and one national final per category, plus the grand final — all saved as linked drafts.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="cs-season" className="mb-1.5 block text-sm font-semibold">Season name</label>
              <input id="cs-season" className="c53-input" value={form.season} onChange={(e) => set('season', e.target.value)} />
            </div>
            <div>
              <label htmlFor="cs-topn" className="mb-1.5 block text-sm font-semibold">Winners advancing per division</label>
              <input id="cs-topn" type="number" min="1" className="c53-input" value={form.top_n_advance} onChange={(e) => set('top_n_advance', e.target.value)} />
            </div>
          </div>

          <div>
            <span className="mb-1.5 block text-sm font-semibold">Categories</span>
            <div className="grid gap-1.5 sm:grid-cols-2">
              {(categories || []).map((c) => {
                const value = c.key || c.value || c.slug || c.id;
                return (
                  <label key={value} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={form.categories.includes(value)} onChange={() => toggleCategory(value)} />
                    {c.label || c.name}
                  </label>
                );
              })}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {DATE_FIELDS.map(([k, label]) => (
              <div key={k}>
                <label htmlFor={`cs-${k}`} className="mb-1.5 block text-sm font-semibold">{label}</label>
                <input id={`cs-${k}`} type="date" className="c53-input" value={form[k]} onChange={(e) => set(k, e.target.value)} />
              </div>
            ))}
          </div>

          {plan && (
            <div className="rounded-xl border border-border bg-muted/40 p-4">
              <h4 className="text-sm font-bold">Review: {plan.count} challenges will be created</h4>
              <ul className="mt-2 space-y-1 text-sm">
                {(plan.plan || []).map((c) => (
                  <li key={c.key}>
                    <span className="font-semibold">{c.title}</span>
                    <span className="text-muted-foreground"> · {c.start_date} → {c.end_date}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          {!plan ? (
            <Button onClick={preview} disabled={busy}>{busy ? 'Building plan…' : 'Preview season plan'}</Button>
          ) : (
            <Button onClick={create} disabled={busy}>{busy ? 'Creating…' : `Create ${plan.count} challenges`}</Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}