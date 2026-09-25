import { useEffect, useState } from 'react';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { listSponsors, saveSponsor, deleteSponsor } from '@/lib/marketing';

export default function SponsorManager() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({ name: '', organisation: '', contact_name: '', contact_email: '', competition_ids: '' });
  const [busy, setBusy] = useState(false);

  const load = async () => { setLoading(true); try { const r = await listSponsors(); setList(r?.sponsors || []); } catch { setList([]); } finally { setLoading(false); } };
  useEffect(() => { load(); }, []);

  const save = async (e) => {
    e.preventDefault(); setBusy(true);
    try {
      await saveSponsor({ ...form, competition_ids: form.competition_ids.split(',').map((s) => s.trim()).filter(Boolean) });
      setShow(false); setForm({ name: '', organisation: '', contact_name: '', contact_email: '', competition_ids: '' }); await load();
    } finally { setBusy(false); }
  };
  const remove = async (id) => { await deleteSponsor(id); load(); };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div><h2 className="font-heading text-xl font-bold">Sponsors</h2><p className="text-sm text-muted-foreground">Sponsor profiles gate the read-only Sponsor Portal to their assigned competitions.</p></div>
        <button onClick={() => setShow((v) => !v)} className="inline-flex items-center gap-1.5 rounded-xl grad-bg px-4 py-2 text-sm font-bold text-white"><Plus className="h-4 w-4" /> New sponsor</button>
      </div>
      {show && (
        <form onSubmit={save} className="grid gap-4 rounded-2xl border border-border bg-card p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm"><span className="mb-1.5 block font-medium">Name</span><input className="c53-input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required /></label>
            <label className="text-sm"><span className="mb-1.5 block font-medium">Organisation</span><input className="c53-input" value={form.organisation} onChange={(e) => setForm((f) => ({ ...f, organisation: e.target.value }))} /></label>
            <label className="text-sm"><span className="mb-1.5 block font-medium">Contact name</span><input className="c53-input" value={form.contact_name} onChange={(e) => setForm((f) => ({ ...f, contact_name: e.target.value }))} /></label>
            <label className="text-sm"><span className="mb-1.5 block font-medium">Contact email</span><input type="email" className="c53-input" value={form.contact_email} onChange={(e) => setForm((f) => ({ ...f, contact_email: e.target.value }))} required /></label>
          </div>
          <label className="text-sm"><span className="mb-1.5 block font-medium">Competition IDs (comma separated)</span><input className="c53-input" value={form.competition_ids} onChange={(e) => setForm((f) => ({ ...f, competition_ids: e.target.value }))} placeholder="abc123, def456" /></label>
          <button disabled={busy} className="rounded-xl bg-primary px-5 py-2 text-sm font-bold text-primary-foreground">{busy ? 'Saving…' : 'Save sponsor'}</button>
        </form>
      )}
      {loading ? <Loader2 className="h-6 w-6 animate-spin text-primary" /> : (
        <div className="space-y-3">
          {list.map((s) => (
            <div key={s.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4">
              <div><p className="font-semibold">{s.name}</p><p className="text-xs text-muted-foreground">{s.organisation} · {s.contact_email} · {(s.competition_ids || []).length} competitions</p></div>
              <button onClick={() => remove(s.id)} className="inline-flex items-center gap-1 text-xs text-destructive hover:underline"><Trash2 className="h-3.5 w-3.5" /> Remove</button>
            </div>
          ))}
          {!list.length && <p className="text-sm text-muted-foreground">No sponsor profiles yet.</p>}
        </div>
      )}
    </div>
  );
}