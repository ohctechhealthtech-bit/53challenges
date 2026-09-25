import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, ShieldAlert, Loader2, RefreshCw, ChevronRight, ScrollText } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import ComplianceGateEditor from '@/components/compliance/ComplianceGateEditor';

export default function ComplianceGateAdmin() {
  const [gates, setGates] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [editing, setEditing] = React.useState(null);
  const [audit, setAudit] = React.useState(null);
  const [auditGate, setAuditGate] = React.useState(null);
  const [syncing, setSyncing] = React.useState(false);
  const [syncResult, setSyncResult] = React.useState('');
  const [filter, setFilter] = React.useState('');

  const load = async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke('complianceGate', { action: 'list' });
      setGates(res.data?.gates || []);
    } catch {}
    setLoading(false);
  };

  React.useEffect(() => { load(); }, []);

  const sync = async () => {
    setSyncing(true); setSyncResult('');
    try {
      const res = await base44.functions.invoke('complianceGate', { action: 'sync' });
      const s = res.data?.sync;
      if (s) setSyncResult(`Created ${s.created} gates (${s.grandfathered} grandfathered live, ${s.skipped} already existed) from ${s.total} upstream challenges.`);
      await load();
    } catch (e) {
      setSyncResult(`Sync failed: ${e?.message || ''}`);
    }
    setSyncing(false);
  };

  const openAudit = async (gate) => {
    setAuditGate(gate);
    setAudit(null);
    try {
      const res = await base44.functions.invoke('complianceGate', { action: 'audit', gate_id: gate.id });
      setAudit(res.data?.logs || []);
    } catch {}
  };

  const filtered = gates.filter((g) => {
    const q = filter.toLowerCase();
    return !q || (g.challenge_title || '').toLowerCase().includes(q) || (g.challenge_id || '').toLowerCase().includes(q);
  });

  return (
    <div className="container-tight py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-extrabold">
            <ShieldCheck className="h-6 w-6 text-primary" /> Interim Legal Gate
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manual compliance containment while legal advice is obtained. Blocking is enforced server-side on every entry, vote and publish this app proxies upstream.
          </p>
        </div>
        <button
          onClick={sync}
          disabled={syncing}
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-white/5 px-4 py-2 text-sm font-semibold disabled:opacity-50"
        >
          {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Sync from Challenge API
        </button>
      </div>

      {syncResult && <p className="mt-3 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">{syncResult}</p>}

      <div className="mt-5">
        <input
          className="c53-input"
          placeholder="Filter by challenge title or ID…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <div className="mt-10 rounded-xl border border-dashed border-border p-10 text-center">
          <p className="text-sm text-muted-foreground">No gates yet. Run <strong>Sync from Challenge API</strong> to create a gate for every upstream challenge.</p>
        </div>
      ) : (
        <div className="mt-5 overflow-hidden rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Challenge</th>
                <th className="px-4 py-3">Legal review</th>
                <th className="px-4 py-3">Checks</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((g) => {
                const checks = [g.promoter_confirmed, g.terms_approved, g.minor_participation_reviewed, g.permit_position_recorded, g.prize_funding_confirmed].filter(Boolean).length;
                return (
                  <tr key={g.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <p className="font-semibold">{g.challenge_title || '(untitled)'}</p>
                      <p className="text-xs text-muted-foreground">{g.challenge_id}</p>
                      {g.grandfathered_live && <span className="mt-0.5 inline-block rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-500">Grandfathered live</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        g.legal_review_status === 'cleared' ? 'bg-emerald-500/15 text-emerald-500' :
                        g.legal_review_status === 'in_progress' ? 'bg-blue-500/15 text-blue-500' :
                        g.legal_review_status === 'blocked' ? 'bg-destructive/15 text-destructive' :
                        'bg-muted text-muted-foreground'
                      }`}>{g.legal_review_status || 'not_started'}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{checks}/5</td>
                    <td className="px-4 py-3">
                      {g.launch_blocked ? (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-destructive"><ShieldAlert className="h-3.5 w-3.5" /> Blocked</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-500"><ShieldCheck className="h-3.5 w-3.5" /> Live</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => setEditing(g)} className="text-xs font-semibold text-primary hover:underline">Edit</button>
                      <button onClick={() => openAudit(g)} className="ml-3 inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground"><ScrollText className="h-3.5 w-3.5" /> Audit</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-4 text-xs text-muted-foreground">
        <Link to="/dashboard" className="hover:underline">← Back to Admin Dashboard</Link>
      </p>

      {editing && (
        <ComplianceGateEditor
          gate={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}

      {auditGate && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4">
          <div className="my-8 w-full max-w-2xl rounded-2xl border border-border bg-card p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-lg font-bold"><ScrollText className="h-5 w-5" /> Audit log</h3>
              <button onClick={() => setAuditGate(null)} className="rounded-lg p-1.5 hover:bg-muted">✕</button>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">{auditGate.challenge_title || auditGate.challenge_id}</p>
            <div className="mt-4 max-h-[60vh] space-y-2 overflow-y-auto">
              {audit === null ? (
                <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
              ) : audit.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">No events yet.</p>
              ) : audit.map((l) => (
                <div key={l.id} className="rounded-lg border border-border bg-white/5 p-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold uppercase tracking-wide text-primary">{l.action}</span>
                    <span className="text-muted-foreground">{new Date(l.created_date).toLocaleString()}</span>
                  </div>
                  {l.field_name && <p className="mt-1 text-muted-foreground">{l.field_name}: {l.old_value || '(empty)'} → {l.new_value || '(empty)'}</p>}
                  {l.note && <p className="mt-1 text-foreground">{l.note}</p>}
                  {l.changed_by_email && <p className="mt-1 text-muted-foreground">by {l.changed_by_email}</p>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}