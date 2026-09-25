import { useEffect, useState } from 'react';
import { Plus, CheckCircle2, FileX, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { GATE_OPTIONS } from '@/components/compliance/GatePanel';

async function invoke(action, payload = {}) {
  return base44.functions.invoke('runComplianceAssessment', { action, ...payload });
}

const OBLIGATION_TYPES = ['permit_required', 'notification_required', 'legal_review_required', 'consent_required', 'tandc_clause_required', 'prize_restriction', 'recordkeeping', 'advertising_restriction'];
const SATISFIED_BY = ['permit_record', 'legal_signoff', 'consent_records', 'tandc_clause', 'evidence_item', 'authority_reference'];

export default function RulePanel() {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNewRule, setShowNewRule] = useState(false);
  const [newRule, setNewRule] = useState({ code: '', name: '', jurisdiction_code: 'NSW', trigger_code: '', description: '' });
  const [showVersion, setShowVersion] = useState(null); // rule_code
  const [newVer, setNewVer] = useState({ obligation_type: 'notification_required', detail: '', blocking: true, satisfied_by: 'evidence_item', gate: 'publish', condition_json: '' });
  const [signing, setSigning] = useState(null); // version_id
  const [signForm, setSignForm] = useState({ reviewer: '', date: '', reference: '' });

  const load = async () => {
    setLoading(true);
    try {
      const { rules: r } = await invoke('list_rules');
      setRules(r || []);
    } catch { /* non-fatal */ } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const createRule = async () => {
    if (!newRule.code || !newRule.name) return;
    await invoke('create_rule', newRule);
    setNewRule({ code: '', name: '', jurisdiction_code: 'NSW', trigger_code: '', description: '' });
    setShowNewRule(false);
    load();
  };

  const createVersion = async (rule_code) => {
    let cond = {};
    if (newVer.condition_json.trim()) {
      try { cond = JSON.parse(newVer.condition_json); } catch { cond = {}; }
    }
    await invoke('create_rule_version', { rule_code, ...newVer, condition_expression: cond });
    setNewVer({ obligation_type: 'notification_required', detail: '', blocking: true, satisfied_by: 'evidence_item', gate: 'publish', condition_json: '' });
    setShowVersion(null);
    load();
  };

  const signVersion = async (version_id) => {
    if (!signForm.reviewer || !signForm.date || !signForm.reference) return;
    await invoke('sign_rule_version', { version_id, ...signForm });
    setSigning(null);
    setSignForm({ reviewer: '', date: '', reference: '' });
    load();
  };

  if (loading) return <div className="py-20 text-center text-muted-foreground">Loading rules…</div>;

  return (
    <div className="space-y-4">
      <button onClick={() => setShowNewRule(!showNewRule)}
        className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
        <Plus className="h-4 w-4" /> New Rule
      </button>

      {showNewRule && (
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="mb-3 font-heading text-sm font-bold">Create Regulatory Rule</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <input placeholder="Code (e.g. nsw_prize_notification)" value={newRule.code} onChange={(e) => setNewRule({ ...newRule, code: e.target.value })} className="c53-input" />
            <input placeholder="Name" value={newRule.name} onChange={(e) => setNewRule({ ...newRule, name: e.target.value })} className="c53-input" />
            <select value={newRule.jurisdiction_code} onChange={(e) => setNewRule({ ...newRule, jurisdiction_code: e.target.value })} className="c53-input">
              {['NSW','VIC','QLD','WA','SA','TAS','ACT','NT','NATIONAL'].map((j) => <option key={j} value={j}>{j}</option>)}
            </select>
            <input placeholder="Trigger code (or empty for threshold-only)" value={newRule.trigger_code} onChange={(e) => setNewRule({ ...newRule, trigger_code: e.target.value })} className="c53-input" />
          </div>
          <textarea placeholder="Description" value={newRule.description} onChange={(e) => setNewRule({ ...newRule, description: e.target.value })} className="c53-input mt-3" rows={2} />
          <button onClick={createRule} className="mt-3 rounded-lg bg-secondary px-4 py-2 text-sm font-semibold text-foreground">Create</button>
        </div>
      )}

      {rules.map((r) => (
        <div key={r.id} className="rounded-xl border border-border bg-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <code className="text-xs font-bold text-primary">{r.code}</code>
              <span className="ml-2 text-sm font-semibold">{r.name}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{r.jurisdiction_code}</span>
              {r.trigger_code && <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs text-primary">trigger: {r.trigger_code}</span>}
              <button onClick={() => setShowVersion(showVersion === r.code ? null : r.code)}
                className="rounded-lg bg-secondary px-3 py-1 text-xs font-semibold text-foreground">+ Version</button>
            </div>
          </div>

          {r.versions?.length > 0 && (
            <div className="mt-3 space-y-2">
              {r.versions.map((v) => {
                const signed = v.legal_signoff?.reviewer && v.legal_signoff?.date && v.legal_signoff?.reference;
                return (
                  <div key={v.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-black/20 px-3 py-2">
                    <div className="flex items-center gap-2">
                      {signed ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : <FileX className="h-4 w-4 text-amber-400" />}
                      <span className="text-xs font-semibold">v{v.version_number}</span>
                      <span className="text-xs text-muted-foreground">{v.obligation_type}</span>
                      {v.blocking && <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-xs text-destructive">blocking</span>}
                      <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs text-primary">gate: {v.gate || 'publish'}</span>
                      <span className="text-xs text-muted-foreground">satisfied_by: {v.satisfied_by}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {signed ? (
                        <span className="text-xs text-emerald-400">Signed by {v.legal_signoff.reviewer}</span>
                      ) : (
                        <button onClick={() => setSigning(signing === v.id ? null : v.id)}
                          className="rounded-lg bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">Sign</button>
                      )}
                    </div>
                    {signing === v.id && (
                      <div className="mt-2 w-full grid gap-2 sm:grid-cols-4">
                        <input placeholder="Reviewer" value={signForm.reviewer} onChange={(e) => setSignForm({ ...signForm, reviewer: e.target.value })} className="c53-input" />
                        <input type="date" value={signForm.date} onChange={(e) => setSignForm({ ...signForm, date: e.target.value })} className="c53-input" />
                        <input placeholder="Advice reference" value={signForm.reference} onChange={(e) => setSignForm({ ...signForm, reference: e.target.value })} className="c53-input" />
                        <button onClick={() => signVersion(v.id)} className="rounded-lg bg-secondary px-4 py-2 text-sm font-semibold text-foreground">Confirm Sign</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {showVersion === r.code && (
            <div className="mt-3 rounded-lg bg-black/20 p-3">
              <h4 className="mb-2 text-xs font-bold">New Version for {r.code}</h4>
              <div className="grid gap-2 sm:grid-cols-2">
                <select value={newVer.obligation_type} onChange={(e) => setNewVer({ ...newVer, obligation_type: e.target.value })} className="c53-input">
                  {OBLIGATION_TYPES.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
                <select value={newVer.satisfied_by} onChange={(e) => setNewVer({ ...newVer, satisfied_by: e.target.value })} className="c53-input">
                  {SATISFIED_BY.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <select value={newVer.gate} onChange={(e) => setNewVer({ ...newVer, gate: e.target.value })} className="c53-input">
                  {GATE_OPTIONS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
                </select>
              </div>
              <textarea placeholder="Detail text" value={newVer.detail} onChange={(e) => setNewVer({ ...newVer, detail: e.target.value })} className="c53-input mt-2" rows={2} />
              <input placeholder='Condition JSON, e.g. {"conditions":[{"field":"prize_pool","operator":"gt","value":10000}]}' value={newVer.condition_json} onChange={(e) => setNewVer({ ...newVer, condition_json: e.target.value })} className="c53-input mt-2" />
              <label className="mt-2 flex items-center gap-2 text-xs"><input type="checkbox" checked={newVer.blocking} onChange={(e) => setNewVer({ ...newVer, blocking: e.target.checked })} /> Blocking</label>
              <button onClick={() => createVersion(r.code)} className="mt-2 rounded-lg bg-secondary px-4 py-2 text-sm font-semibold text-foreground">Create Version</button>
            </div>
          )}
        </div>
      ))}
      {rules.length === 0 && <div className="py-10 text-center text-muted-foreground">No rules yet. Create one or seed the jurisdiction drafts.</div>}
    </div>
  );
}