import { useEffect, useState } from 'react';
import { Send, Plus, AlertTriangle, Sparkles, Loader2 } from 'lucide-react';
import { createCampaign, sendCampaign, listCampaigns, listCanonicalCategories, aiCampaignCopy, AUDIENCE_TYPES, CATEGORIES } from '@/lib/marketing';
import { STATES } from '@/lib/challenges-data';

const TYPE_TEMPLATES = {
  announcement: { subject: 'New challenge is live on 53 Challenges', body: 'Hi {{name}},\n\nA new creative challenge just opened. Enter or vote now:\n\n— 53 Challenges' },
  deadline_reminder: { subject: 'Final days to enter', body: "Hi {{name}},\n\nTime is running out to submit your entry. Don't miss out!\n\n— 53 Challenges" },
  results: { subject: 'Results are in', body: 'Hi {{name}},\n\nThe results have been announced. See the winners on the challenge page.\n\n— 53 Challenges' },
  voting_open: { subject: 'Voting is open', body: 'Hi {{name}},\n\nVoting is now open. Support your favourite creators.\n\n— 53 Challenges' },
  results_announced: { subject: 'Results announced', body: 'Hi {{name}},\n\nWinners have been announced. Head to the challenge page to celebrate them.\n\n— 53 Challenges' },
};

export default function CampaignBuilder() {
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({ name: '', type: 'announcement', audience_types: [], states: [], categories: [], participated_only: false, subject: '', body: '' });
  const [busy, setBusy] = useState(false);
  const [campaigns, setCampaigns] = useState([]);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [categories, setCategories] = useState(CATEGORIES);
  const [drafting, setDrafting] = useState(false);

  const draftCopy = async () => {
    setDrafting(true); setError('');
    try {
      const d = await aiCampaignCopy(form);
      if (d?.error) throw new Error(d.error);
      setForm((f) => ({ ...f, subject: d.subject || f.subject, body: d.body || f.body }));
    } catch (e) { setError(e?.message || 'Could not draft the copy.'); } finally { setDrafting(false); }
  };

  const load = async () => {
    try {
      const d = await listCampaigns();
      if (d?.error) throw new Error(d.error);
      setCampaigns(d.campaigns || []);
    } catch (e) {
      setError(e?.message || 'Could not load campaigns.');
    }
  };
  useEffect(() => {
    load();
    // Canonical categories, merged with the legacy list so existing
    // AudienceMember interests keep filtering correctly.
    listCanonicalCategories()
      .then((d) => {
        const names = (d?.categories || []).map((c) => c.name);
        if (names.length) setCategories([...new Set([...names, ...CATEGORIES])]);
      })
      .catch(() => {});
  }, []);

  const toggle = (key, val) => setForm((f) => ({ ...f, [key]: f[key].includes(val) ? f[key].filter((x) => x !== val) : [...f[key], val] }));
  const onType = (t) => { const tpl = TYPE_TEMPLATES[t] || {}; setForm((f) => ({ ...f, type: t, subject: tpl.subject || f.subject, body: tpl.body || f.body })); };
  const create = async (e) => {
    e.preventDefault(); setBusy(true); setError('');
    try {
      const d = await createCampaign(form);
      if (d?.error) throw new Error(d.error);
      setShow(false);
      setForm({ name: '', type: 'announcement', audience_types: [], states: [], categories: [], participated_only: false, subject: '', body: '' });
      await load();
    } catch (e2) { setError(e2?.message || 'Could not create the campaign.'); } finally { setBusy(false); }
  };
  const send = async (id) => {
    setBusy(true); setResult(null); setError('');
    try {
      const d = await sendCampaign(id);
      if (d?.error) throw new Error(d.error);
      setResult(d);
      await load();
    } catch (e2) { setError(e2?.message || 'Could not send the campaign.'); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-xl font-bold">Campaigns</h2>
        <button onClick={() => setShow((v) => !v)} className="inline-flex items-center gap-1.5 rounded-xl grad-bg px-4 py-2 text-sm font-bold text-white"><Plus className="h-4 w-4" /> New campaign</button>
      </div>
      {show && (
        <form onSubmit={create} className="space-y-4 rounded-2xl border border-border bg-card p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm"><span className="mb-1.5 block font-medium">Campaign name</span><input className="c53-input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required /></label>
            <label className="text-sm"><span className="mb-1.5 block font-medium">Type</span>
              <select className="c53-input" value={form.type} onChange={(e) => onType(e.target.value)}>{Object.keys(TYPE_TEMPLATES).map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}</select>
            </label>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <ChipGroup label="Audience types" options={AUDIENCE_TYPES} selected={form.audience_types} onToggle={(v) => toggle('audience_types', v)} />
            <ChipGroup label="States" options={STATES.slice(0, 8)} selected={form.states} onToggle={(v) => toggle('states', v)} />
            <ChipGroup label="Categories" options={categories.slice(0, 10)} selected={form.categories} onToggle={(v) => toggle('categories', v)} />
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.participated_only} onChange={(e) => setForm((f) => ({ ...f, participated_only: e.target.checked }))} /> Past participants only</label>
          <button type="button" onClick={draftCopy} disabled={drafting} className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-secondary px-3 py-2 text-xs font-semibold hover:border-primary/40 disabled:opacity-60">
            {drafting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 text-primary" />}
            {drafting ? 'Writing copy…' : 'Draft copy with AI'}
          </button>
          <label className="block text-sm"><span className="mb-1.5 block font-medium">Subject</span><input className="c53-input" value={form.subject} onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))} required /></label>
          <label className="block text-sm"><span className="mb-1.5 block font-medium">Body</span><textarea className="c53-input min-h-28" value={form.body} onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))} required /><p className="mt-1 text-xs text-muted-foreground">Use {'{{name}}'} to personalise. Only registered app users receive email.</p></label>
          <button disabled={busy} className="rounded-xl bg-primary px-5 py-2 text-sm font-bold text-primary-foreground">{busy ? 'Saving…' : 'Create campaign'}</button>
        </form>
      )}
      {error && <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"><AlertTriangle className="h-4 w-4 shrink-0" /> {error}</div>}
      {result && <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-4 py-3 text-sm">Campaign sent: <b>{result.sent}</b> delivered · <b>{result.skipped}</b> skipped (unregistered) of {result.audience_count} matched. Only registered app users can receive email until an external provider is connected.</div>}
      <div className="space-y-3">
        {campaigns.map((c) => (
          <div key={c.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4">
            <div>
              <p className="font-semibold">{c.name}</p>
              <p className="text-xs text-muted-foreground">{c.type.replace(/_/g, ' ')} · {c.status}{c.sent_at ? ` · ${new Date(c.sent_at).toLocaleDateString()}` : ''}</p>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              {c.status === 'sent' && <span>{c.sent_count} sent · {c.skipped_unregistered} skipped</span>}
              {c.status === 'draft' && <button onClick={() => send(c.id)} disabled={busy} className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"><Send className="h-4 w-4" /> Send</button>}
            </div>
          </div>
        ))}
        {!campaigns.length && <p className="text-sm text-muted-foreground">No campaigns yet.</p>}
      </div>
    </div>
  );
}

function ChipGroup({ label, options, selected, onToggle }) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-medium text-muted-foreground">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => (
          <button type="button" key={o} onClick={() => onToggle(o)} className={`rounded-full px-2.5 py-1 text-xs font-semibold ${selected.includes(o) ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>{o}</button>
        ))}
      </div>
    </div>
  );
}