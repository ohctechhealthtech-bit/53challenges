import { useState } from 'react';
import { Save, Trash2, Plus, X, Loader2, Network } from 'lucide-react';
import { PATHWAY_TYPES, MEMBER_KINDS, savePathway, deletePathway, saveMember, removeMember } from '@/lib/pathways';

const EMPTY = { name: '', type: 'national_state_ranking', description: '', season_label: '', anchor_challenge_id: '', access_code: '', approved_organisations: [], invited_emails: [], points_scale: [10, 8, 6, 5, 4, 3, 2, 1], promotion_count: 3, status: 'draft' };

export default function PathwayEditor({ pathway, members, competitions, onChanged, onDeleted }) {
  const [f, setF] = useState(pathway ? normalize(pathway) : EMPTY);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [orgInput, setOrgInput] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [scaleInput, setScaleInput] = useState((f.points_scale || []).join(', '));

  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const typeMeta = PATHWAY_TYPES.find((t) => t.value === f.type) || PATHWAY_TYPES[0];

  const save = async () => {
    setBusy(true); setErr('');
    try {
      const scale = scaleInput.split(',').map((s) => Number(s.trim())).filter((n) => !isNaN(n) && n > 0);
      await savePathway({ ...f, points_scale: scale.length ? scale : [10, 8, 6, 5, 4, 3, 2, 1] });
      onChanged();
    } catch (e) { setErr(e.message || 'Failed'); }
    finally { setBusy(false); }
  };

  const remove = async () => {
    if (!pathway?.id) return;
    if (!confirm('Delete this pathway and all its links/promotions/standings?')) return;
    setBusy(true);
    try { await deletePathway(pathway.id); onDeleted(); }
    catch (e) { setErr(e.message || 'Failed'); }
    finally { setBusy(false); }
  };

  const needsSeries = f.type === 'series_championship';
  const needsQualifiers = f.type === 'state_to_national' || f.type === 'local_to_state_to_national';
  const needsAnchor = f.type !== 'series_championship' || true; // series uses member links; anchor optional
  const isPrivate = f.type === 'private_organisation' || f.type === 'invitational';

  const addOrg = () => { const v = orgInput.trim(); if (!v) return; set('approved_organisations', [...f.approved_organisations, v]); setOrgInput(''); };
  const addEmail = () => { const v = emailInput.trim().toLowerCase(); if (!v || !v.includes('@')) return; set('invited_emails', [...f.invited_emails, v]); setEmailInput(''); };

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Network className="h-5 w-5 text-primary" />
          <h3 className="font-heading text-lg font-bold">{pathway ? 'Edit pathway' : 'New pathway'}</h3>
        </div>
        <span className="text-xs text-muted-foreground">{typeMeta.desc}</span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-sm"><span className="text-muted-foreground">Name *</span>
          <input className="c53-input mt-1" value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. 2026 National Poetry Series" />
        </label>
        <label className="text-sm"><span className="text-muted-foreground">Pathway type</span>
          <select className="c53-input mt-1" value={f.type} onChange={(e) => set('type', e.target.value)}>
            {PATHWAY_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </label>
        <label className="text-sm"><span className="text-muted-foreground">Season label</span>
          <input className="c53-input mt-1" value={f.season_label} onChange={(e) => set('season_label', e.target.value)} placeholder="e.g. Spring 2026" />
        </label>
        <label className="text-sm"><span className="text-muted-foreground">Status</span>
          <select className="c53-input mt-1" value={f.status} onChange={(e) => set('status', e.target.value)}>
            <option value="draft">Draft</option>
            <option value="active">Active</option>
            <option value="archived">Archived</option>
          </select>
        </label>
        <label className="text-sm sm:col-span-2"><span className="text-muted-foreground">Description</span>
          <textarea className="c53-input mt-1 min-h-16" value={f.description} onChange={(e) => set('description', e.target.value)} />
        </label>
      </div>

      {/* Anchor (national final / single pool) */}
      {(f.type === 'national_state_ranking' || needsQualifiers) && (
        <label className="mt-3 block text-sm">
          <span className="text-muted-foreground">{needsQualifiers ? 'National final challenge' : 'Entry-pool challenge (anchor)'}</span>
          <select className="c53-input mt-1" value={f.anchor_challenge_id} onChange={(e) => set('anchor_challenge_id', e.target.value)}>
            <option value="">Select…</option>
            {competitions.map((c) => <option key={c.id} value={c.id}>{c.title || c.theme}</option>)}
          </select>
        </label>
      )}

      {/* Promotion count for qualifier pathways */}
      {needsQualifiers && (
        <label className="mt-3 block text-sm">
          <span className="text-muted-foreground">Default winners promoted per qualifier</span>
          <input type="number" min={1} max={20} className="c53-input mt-1 w-40" value={f.promotion_count} onChange={(e) => set('promotion_count', Number(e.target.value))} />
        </label>
      )}

      {/* Series points scale */}
      {needsSeries && (
        <label className="mt-3 block text-sm">
          <span className="text-muted-foreground">Points scale (1st, 2nd, 3rd…) — comma separated</span>
          <input className="c53-input mt-1" value={scaleInput} onChange={(e) => setScaleInput(e.target.value)} placeholder="10, 8, 6, 5, 4, 3, 2, 1" />
        </label>
      )}

      {/* Private / invitational gating */}
      {isPrivate && (
        <div className="mt-4 space-y-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
          <label className="block text-sm">
            <span className="text-muted-foreground">Access code (optional — bypasses org/invite list)</span>
            <input className="c53-input mt-1" value={f.access_code} onChange={(e) => set('access_code', e.target.value)} placeholder="e.g. ACME2026" />
          </label>
          {f.type === 'private_organisation' && (
            <div>
              <span className="text-sm text-muted-foreground">Approved organisations</span>
              <div className="mt-1 flex gap-2">
                <input className="c53-input" value={orgInput} onChange={(e) => setOrgInput(e.target.value)} placeholder="Organisation name" />
                <button onClick={addOrg} className="rounded-xl bg-white/5 px-3 text-sm font-semibold hover:bg-muted"><Plus className="h-4 w-4" /></button>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {f.approved_organisations.map((o, i) => (
                  <span key={i} className="inline-flex items-center gap-1 rounded-full bg-white/5 px-2.5 py-1 text-xs font-semibold">
                    {o}<button onClick={() => set('approved_organisations', f.approved_organisations.filter((_, idx) => idx !== i))} className="text-muted-foreground hover:text-destructive"><X className="h-3 w-3" /></button>
                  </span>
                ))}
              </div>
            </div>
          )}
          {f.type === 'invitational' && (
            <div>
              <span className="text-sm text-muted-foreground">Invited emails</span>
              <div className="mt-1 flex gap-2">
                <input className="c53-input" value={emailInput} onChange={(e) => setEmailInput(e.target.value)} placeholder="name@email.com" />
                <button onClick={addEmail} className="rounded-xl bg-white/5 px-3 text-sm font-semibold hover:bg-muted"><Plus className="h-4 w-4" /></button>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {f.invited_emails.map((o, i) => (
                  <span key={i} className="inline-flex items-center gap-1 rounded-full bg-white/5 px-2.5 py-1 text-xs font-semibold">
                    {o}<button onClick={() => set('invited_emails', f.invited_emails.filter((_, idx) => idx !== i))} className="text-muted-foreground hover:text-destructive"><X className="h-3 w-3" /></button>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Members */}
      {pathway?.id && (
        <MembersBlock pathwayId={pathway.id} members={members} competitions={competitions} onChanged={onChanged} defaultKind={needsSeries ? 'series_event' : (needsQualifiers ? 'state_qualifier' : 'anchor')} />
      )}

      {err && <p className="mt-3 text-sm text-destructive">{err}</p>}
      <div className="mt-4 flex flex-wrap gap-2">
        <button onClick={save} disabled={busy || !f.name} className="inline-flex items-center gap-1.5 rounded-xl grad-bg px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save pathway
        </button>
        {pathway?.id && (
          <button onClick={remove} disabled={busy} className="inline-flex items-center gap-1.5 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm font-bold text-destructive disabled:opacity-50">
            <Trash2 className="h-4 w-4" /> Delete
          </button>
        )}
      </div>
    </div>
  );
}

function MembersBlock({ pathwayId, members, competitions, onChanged, defaultKind }) {
  const [m, setM] = useState({ challenge_id: '', member_kind: defaultKind, region: '', tier: 1, promotion_to_challenge_id: '', promotion_count_override: 0 });
  const [busy, setBusy] = useState(false);
  const add = async () => {
    if (!m.challenge_id) return;
    setBusy(true);
    try {
      const c = competitions.find((x) => x.id === m.challenge_id);
      await saveMember({ ...m, pathway_id: pathwayId, challenge_title: c?.title || c?.theme || '' });
      setM({ challenge_id: '', member_kind: defaultKind, region: '', tier: 1, promotion_to_challenge_id: '', promotion_count_override: 0 });
      onChanged();
    } finally { setBusy(false); }
  };
  return (
    <div className="mt-4 rounded-xl border border-border bg-white/5 p-4">
      <h4 className="text-sm font-bold">Linked competitions</h4>
      <div className="mt-2 space-y-1.5">
        {(members || []).map((x) => (
          <div key={x.id} className="flex items-center gap-2 rounded-lg border border-border bg-background/40 p-2 text-xs">
            <span className="rounded bg-primary/15 px-2 py-0.5 font-semibold text-primary">{(MEMBER_KINDS.find((k) => k.value === x.member_kind) || {}).label || x.member_kind}</span>
            <span className="font-semibold">{x.challenge_title || x.challenge_id}</span>
            {x.region && <span className="text-muted-foreground">· {x.region}</span>}
            {x.promotion_to_challenge_id && <span className="text-emerald-400">→ promotes to {competitions.find((c) => c.id === x.promotion_to_challenge_id)?.title || x.promotion_to_challenge_id}</span>}
            <button onClick={() => removeMember(x.id).then(onChanged)} className="ml-auto text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
          </div>
        ))}
        {!members?.length && <p className="text-xs text-muted-foreground">No competitions linked yet.</p>}
      </div>
      <div className="mt-3 flex flex-wrap items-end gap-2">
        <label className="text-xs"><span className="text-muted-foreground">Competition</span>
          <select className="c53-input mt-1 w-48" value={m.challenge_id} onChange={(e) => setM({ ...m, challenge_id: e.target.value })}>
            <option value="">Select…</option>
            {competitions.map((c) => <option key={c.id} value={c.id}>{c.title || c.theme}</option>)}
          </select>
        </label>
        <label className="text-xs"><span className="text-muted-foreground">Kind</span>
          <select className="c53-input mt-1 w-40" value={m.member_kind} onChange={(e) => setM({ ...m, member_kind: e.target.value })}>
            {MEMBER_KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
          </select>
        </label>
        <label className="text-xs"><span className="text-muted-foreground">Region</span>
          <input className="c53-input mt-1 w-28" value={m.region} onChange={(e) => setM({ ...m, region: e.target.value })} placeholder="e.g. QLD" />
        </label>
        <label className="text-xs"><span className="text-muted-foreground">Promotes to</span>
          <select className="c53-input mt-1 w-40" value={m.promotion_to_challenge_id} onChange={(e) => setM({ ...m, promotion_to_challenge_id: e.target.value })}>
            <option value="">—</option>
            {competitions.map((c) => <option key={c.id} value={c.id}>{c.title || c.theme}</option>)}
          </select>
        </label>
        <button onClick={add} disabled={busy || !m.challenge_id} className="rounded-xl bg-white/5 px-3 py-2 text-sm font-semibold hover:bg-muted disabled:opacity-50"><Plus className="h-4 w-4" /></button>
      </div>
    </div>
  );
}

function normalize(p) {
  return {
    id: p.id, name: p.name || '', type: p.type, description: p.description || '', season_label: p.season_label || '',
    anchor_challenge_id: p.anchor_challenge_id || '', access_code: p.access_code || '',
    approved_organisations: p.approved_organisations || [], invited_emails: p.invited_emails || [],
    points_scale: p.points_scale || [10, 8, 6, 5, 4, 3, 2, 1], promotion_count: p.promotion_count || 3, status: p.status || 'draft',
  };
}