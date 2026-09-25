import { useEffect, useState } from 'react';
import { Loader2, Plus, Copy, Trophy } from 'lucide-react';
import { listOrganisations, createOrganisation, organisationLeaderboard, ORG_KINDS } from '@/lib/marketing';
import { STATES } from '@/lib/challenges-data';

export default function OrganisationsPanel() {
  const [orgs, setOrgs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({ name: '', kind: 'club', state: '', contact_email: '' });
  const [busy, setBusy] = useState(false);
  const [board, setBoard] = useState(null);

  const load = async () => { setLoading(true); try { const r = await listOrganisations(); setOrgs(r?.organisations || []); } catch { setOrgs([]); } finally { setLoading(false); } };
  useEffect(() => { load(); }, []);

  const create = async (e) => { e.preventDefault(); setBusy(true); try { await createOrganisation(form); setForm({ name: '', kind: 'club', state: '', contact_email: '' }); setShow(false); await load(); } finally { setBusy(false); } };
  const link = (code) => `${window.location.origin}/?group=${code}`;
  const showBoard = async (id) => { setBoard({ id, loading: true }); try { setBoard({ id, ...(await organisationLeaderboard(id)) }); } catch { setBoard({ id, error: true }); } };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div><h2 className="font-heading text-xl font-bold">Organisations</h2><p className="text-sm text-muted-foreground">Schools, clubs and workplaces. Share the group link so sign-ups are pre-tagged.</p></div>
        <button onClick={() => setShow((v) => !v)} className="inline-flex items-center gap-1.5 rounded-xl grad-bg px-4 py-2 text-sm font-bold text-white"><Plus className="h-4 w-4" /> New</button>
      </div>
      {show && (
        <form onSubmit={create} className="grid gap-4 rounded-2xl border border-border bg-card p-5 sm:grid-cols-4">
          <label className="text-sm sm:col-span-2"><span className="mb-1.5 block font-medium">Name</span><input className="c53-input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required /></label>
          <label className="text-sm"><span className="mb-1.5 block font-medium">Kind</span><select className="c53-input" value={form.kind} onChange={(e) => setForm((f) => ({ ...f, kind: e.target.value }))}>{ORG_KINDS.map((k) => <option key={k} value={k}>{k}</option>)}</select></label>
          <label className="text-sm"><span className="mb-1.5 block font-medium">State</span><select className="c53-input" value={form.state} onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))}><option value="">—</option>{STATES.map((s) => <option key={s} value={s}>{s}</option>)}</select></label>
          <label className="text-sm sm:col-span-4"><span className="mb-1.5 block font-medium">Contact email</span><input type="email" className="c53-input" value={form.contact_email} onChange={(e) => setForm((f) => ({ ...f, contact_email: e.target.value }))} /></label>
          <button disabled={busy} className="sm:col-span-4 rounded-xl bg-primary px-5 py-2 text-sm font-bold text-primary-foreground">{busy ? 'Saving…' : 'Create organisation'}</button>
        </form>
      )}
      {loading ? <Loader2 className="h-6 w-6 animate-spin text-primary" /> : (
        <div className="grid gap-4 md:grid-cols-2">
          {orgs.map((o) => (
            <div key={o.id} className="rounded-2xl border border-border bg-card p-5">
              <div className="flex items-center justify-between">
                <div><p className="font-semibold">{o.name}</p><p className="text-xs text-muted-foreground capitalize">{o.kind} · {o.state || 'AU'}</p></div>
                <button onClick={() => showBoard(o.id)} className="inline-flex items-center gap-1.5 rounded-xl bg-muted px-3 py-1.5 text-xs font-semibold"><Trophy className="h-3.5 w-3.5" /> Leaderboard</button>
              </div>
              <div className="mt-3 flex items-center gap-2 rounded-xl bg-muted/50 px-3 py-2 text-xs">
                <span className="truncate text-muted-foreground">{link(o.signup_code)}</span>
                <Copy className="h-3.5 w-3.5 cursor-pointer text-primary" onClick={() => navigator.clipboard?.writeText(link(o.signup_code))} />
              </div>
              {board?.id === o.id && board.loading && <p className="mt-2 text-xs text-muted-foreground">Loading…</p>}
              {board?.id === o.id && !board.loading && !board.error && (
                <div className="mt-3 space-y-1 text-xs">
                  <p className="text-muted-foreground">{board.members} members · {board.totals?.entries || 0} entries · {board.totals?.votes || 0} votes</p>
                  {(board.rows || []).slice(0, 5).map((r, i) => <div key={i} className="flex justify-between"><span>{i + 1}. {r.name}</span><span>{r.entries}e · {r.votes}v</span></div>)}
                  {!(board.rows || []).length && <p className="text-muted-foreground">No participants yet.</p>}
                </div>
              )}
            </div>
          ))}
          {!orgs.length && <p className="text-sm text-muted-foreground">No organisations yet.</p>}
        </div>
      )}
    </div>
  );
}