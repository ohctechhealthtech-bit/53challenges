import { useEffect, useState } from 'react';
import { FileCheck, Plus, Loader2, Link2, Clock, CheckCircle2, AlertTriangle } from 'lucide-react';
import { base44 } from '@/api/base44Client';

async function invoke(action, payload = {}) {
  return base44.functions.invoke('permitTracker', { action, ...payload });
}

const JURISDICTIONS = ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT', 'NATIONAL'];
const INSTRUMENT_TYPES = ['authority_multiyear', 'permit_single_promotion', 'licence'];
const HOLDERS = ['platform53', 'host_organisation'];
const ACTION_TYPES = ['apply', 'notify_regulator', 'renew', 'lodge_winner_records', 'publish_results_record', 'amend'];

const STATUS_STYLES = {
  active: 'bg-emerald-500/15 text-emerald-400',
  issued: 'bg-emerald-500/15 text-emerald-400',
  expiring_soon: 'bg-amber-500/15 text-amber-400',
  expired: 'bg-destructive/15 text-destructive',
  applied: 'bg-blue-500/15 text-blue-400',
  refused: 'bg-destructive/15 text-destructive',
  surrendered: 'bg-muted text-muted-foreground',
  pending: 'bg-amber-500/15 text-amber-400',
  done: 'bg-emerald-500/15 text-emerald-400',
  overdue: 'bg-destructive/15 text-destructive',
};

export default function PermitPanel() {
  const [permits, setPermits] = useState([]);
  const [actions, setActions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showLink, setShowLink] = useState(false);
  const [error, setError] = useState('');
  const [linkFinding, setLinkFinding] = useState('');
  const [linkPermit, setLinkPermit] = useState('');
  const [newPermit, setNewPermit] = useState({
    jurisdiction_code: 'NSW', instrument_type: 'authority_multiyear', holder: 'platform53',
    reference_number: '', effective_date: '', expiry_date: '', covered_challenges: '', fee: 0,
  });

  const load = async () => {
    setLoading(true); setError('');
    try {
      const [p, a] = await Promise.all([
        invoke('list_permits'),
        invoke('list_actions'),
      ]);
      setPermits(p?.data?.permits ?? p?.permits ?? []);
      setActions(a?.data?.actions ?? a?.actions ?? []);
    } catch (e) { setError(e?.message || 'Load failed'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const createPermit = async () => {
    setError('');
    try {
      const covered = newPermit.covered_challenges
        ? newPermit.covered_challenges.split(',').map((s) => s.trim()).filter(Boolean)
        : [];
      await invoke('create_permit', { ...newPermit, covered_challenges: covered, fee: Number(newPermit.fee) || 0 });
      setNewPermit({ jurisdiction_code: 'NSW', instrument_type: 'authority_multiyear', holder: 'platform53',
        reference_number: '', effective_date: '', expiry_date: '', covered_challenges: '', fee: 0 });
      setShowCreate(false);
      load();
    } catch (e) { setError(e?.message || 'Create failed'); }
  };

  const completeAction = async (action_id) => {
    try { await invoke('complete_action', { action_id }); load(); }
    catch (e) { setError(e?.message || 'Complete failed'); }
  };

  const linkPermitToFinding = async () => {
    setError('');
    try {
      const res = await invoke('link_permit_to_finding', { finding_id: linkFinding, permit_id: linkPermit });
      setShowLink(false); setLinkFinding(''); setLinkPermit('');
      setError(res.satisfied ? 'Permit linked — finding satisfied.' : res.valid ? 'Permit linked but finding not auto-satisfied.' : `Permit linked but INVALID: ${res.reason}`);
      load();
    } catch (e) { setError(e?.message || 'Link failed'); }
  };

  const runExpireCheck = async () => {
    setError('');
    try {
      const res = await invoke('expire_check');
      setError(`Expiry check: ${res.expired} expired, ${res.expiring_soon} expiring soon, ${res.overdue_actions} overdue actions.`);
      load();
    } catch (e) { setError(e?.message || 'Expire check failed'); }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-heading text-sm font-bold">Trade Promotion Permits &amp; Actions</h3>
        <div className="flex gap-2">
          <button onClick={runExpireCheck} className="inline-flex items-center gap-1 rounded-lg bg-secondary px-3 py-1.5 text-xs font-semibold text-foreground">Run Expiry Check</button>
          <button onClick={() => setShowLink(!showLink)} className="inline-flex items-center gap-1 rounded-lg bg-secondary px-3 py-1.5 text-xs font-semibold text-foreground"><Link2 className="h-3 w-3" /> Link Permit</button>
          <button onClick={() => setShowCreate(!showCreate)} className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"><Plus className="h-3 w-3" /> New Permit</button>
        </div>
      </div>

      {error && <div className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive" role="alert">{error}</div>}

      {showCreate && (
        <div className="space-y-2 rounded-xl border border-border bg-card p-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <select value={newPermit.jurisdiction_code} onChange={(e) => setNewPermit({ ...newPermit, jurisdiction_code: e.target.value })} className="c53-input">
              {JURISDICTIONS.map((j) => <option key={j} value={j}>{j}</option>)}
            </select>
            <select value={newPermit.instrument_type} onChange={(e) => setNewPermit({ ...newPermit, instrument_type: e.target.value })} className="c53-input">
              {INSTRUMENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <select value={newPermit.holder} onChange={(e) => setNewPermit({ ...newPermit, holder: e.target.value })} className="c53-input">
              {HOLDERS.map((h) => <option key={h} value={h}>{h}</option>)}
            </select>
            <input placeholder="Reference #" value={newPermit.reference_number} onChange={(e) => setNewPermit({ ...newPermit, reference_number: e.target.value })} className="c53-input" />
            <input type="date" value={newPermit.effective_date} onChange={(e) => setNewPermit({ ...newPermit, effective_date: e.target.value })} className="c53-input" />
            <input type="date" value={newPermit.expiry_date} onChange={(e) => setNewPermit({ ...newPermit, expiry_date: e.target.value })} className="c53-input" />
            <input type="number" placeholder="Fee" value={newPermit.fee} onChange={(e) => setNewPermit({ ...newPermit, fee: e.target.value })} className="c53-input" />
            <input placeholder="Covered challenge IDs (comma-sep)" value={newPermit.covered_challenges} onChange={(e) => setNewPermit({ ...newPermit, covered_challenges: e.target.value })} className="c53-input col-span-2" />
          </div>
          <div className="flex gap-2">
            <button onClick={createPermit} className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground">Create Permit</button>
            <button onClick={() => setShowCreate(false)} className="rounded-lg bg-secondary px-4 py-2 text-xs font-semibold text-foreground">Cancel</button>
          </div>
        </div>
      )}

      {showLink && (
        <div className="flex flex-wrap gap-2 rounded-xl border border-border bg-card p-4">
          <input placeholder="Finding ID" value={linkFinding} onChange={(e) => setLinkFinding(e.target.value)} className="c53-input flex-1" />
          <select value={linkPermit} onChange={(e) => setLinkPermit(e.target.value)} className="c53-input flex-1">
            <option value="">Select permit…</option>
            {permits.map((p) => <option key={p.id} value={p.id}>{p.reference_number} ({p.jurisdiction_code})</option>)}
          </select>
          <button onClick={linkPermitToFinding} disabled={!linkFinding || !linkPermit} className="shrink-0 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50">Link</button>
        </div>
      )}

      {loading ? (
        <div className="py-10 text-center text-muted-foreground"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></div>
      ) : (
        <>
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground">Permits ({permits.length})</p>
            {permits.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">No permits recorded.</p>
            ) : permits.map((p) => (
              <div key={p.id} className="rounded-xl border border-border bg-card p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <FileCheck className="h-4 w-4 text-primary" />
                    <span className="text-sm font-semibold">{p.reference_number}</span>
                    <span className="text-xs text-muted-foreground">{p.jurisdiction_code}</span>
                    <span className="text-xs text-muted-foreground">· {p.instrument_type}</span>
                  </div>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLES[p.status] || 'bg-muted'}`}>{p.status}</span>
                </div>
                <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
                  {p.effective_date && <span>Eff: {p.effective_date}</span>}
                  {p.expiry_date && <span>Exp: {p.expiry_date}</span>}
                  {p.fee > 0 && <span>Fee: ${p.fee}</span>}
                  {p.covered_challenges?.length > 0 && <span>Covers: {p.covered_challenges.length} challenge(s)</span>}
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground">Actions ({actions.length})</p>
            {actions.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">No permit actions.</p>
            ) : actions.map((a) => (
              <div key={a.id} className="rounded-xl border border-border bg-card p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-semibold">{a.action_type}</span>
                    {a.challenge_id && <span className="text-xs text-muted-foreground">· {a.challenge_id}</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    {a.due_date && <span className="text-xs text-muted-foreground">Due: {a.due_date}</span>}
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLES[a.status] || 'bg-muted'}`}>{a.status}</span>
                    {a.status !== 'done' && (
                      <button onClick={() => completeAction(a.id)} className="inline-flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground">
                        <CheckCircle2 className="h-3 w-3" /> Done
                      </button>
                    )}
                  </div>
                </div>
                {a.notes && <p className="mt-1 text-xs text-muted-foreground">{a.notes}</p>}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}