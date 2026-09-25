import React from 'react';
import { ShieldCheck, ShieldAlert, Loader2, Save, X, Check } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { unmetConditions } from '@/lib/complianceGateClient';

const STATUS_OPTIONS = [
  { value: 'not_started', label: 'Not started' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'cleared', label: 'Cleared' },
  { value: 'blocked', label: 'Blocked' },
];

const BOOLEAN_FIELDS = [
  { key: 'promoter_confirmed', label: 'Promoter confirmed' },
  { key: 'terms_approved', label: 'Terms approved' },
  { key: 'minor_participation_reviewed', label: 'Minor participation reviewed' },
  { key: 'voting_reviewed', label: 'Voting reviewed' },
  { key: 'permit_position_recorded', label: 'Permit position recorded' },
  { key: 'prize_funding_confirmed', label: 'Prize funding confirmed' },
];

export default function ComplianceGateEditor({ gate, onSaved, onClose }) {
  const [fields, setFields] = React.useState({
    legal_review_status: gate.legal_review_status || 'not_started',
    promoter_confirmed: !!gate.promoter_confirmed,
    terms_approved: !!gate.terms_approved,
    minor_participation_reviewed: !!gate.minor_participation_reviewed,
    voting_reviewed: !!gate.voting_reviewed,
    permit_position_recorded: !!gate.permit_position_recorded,
    prize_funding_confirmed: !!gate.prize_funding_confirmed,
    launch_blocked: gate.launch_blocked !== false,
    legal_review_reference: gate.legal_review_reference || '',
    gate_notes: gate.gate_notes || '',
  });
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState('');
  const [missing, setMissing] = React.useState([]);

  const allClear = unmetConditions(fields).length === 0;
  const canUnblock = gate.launch_blocked !== false ? allClear : true;

  const toggle = (k) => setFields((p) => ({ ...p, [k]: !p[k] }));

  const save = async () => {
    setSaving(true); setError(''); setMissing([]);
    try {
      const res = await base44.functions.invoke('complianceGate', {
        action: 'update', gate_id: gate.id, fields,
      });
      if (res.data?.error) {
        setError(res.data.error);
        setMissing(res.data.missing || []);
      } else {
        onSaved?.(res.data?.gate);
      }
    } catch (e) {
      const data = e?.response?.data ?? e?.data;
      setError(data?.error || e?.message || 'Save failed');
      setMissing(data?.missing || []);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4">
      <div className="my-8 w-full max-w-2xl rounded-2xl border border-border bg-card p-6 shadow-2xl">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              {fields.launch_blocked ? (
                <ShieldAlert className="h-5 w-5 text-destructive" />
              ) : (
                <ShieldCheck className="h-5 w-5 text-emerald-500" />
              )}
              <h3 className="text-lg font-bold">{gate.challenge_title || gate.challenge_id}</h3>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">Challenge ID: {gate.challenge_id}</p>
            {gate.grandfathered_live && (
              <span className="mt-1 inline-block rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-500">
                Grandfathered live
              </span>
            )}
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-5 space-y-4">
          <div>
            <label className="text-sm font-semibold">Legal review status</label>
            <select
              className="c53-input mt-1"
              value={fields.legal_review_status}
              onChange={(e) => setFields((p) => ({ ...p, legal_review_status: e.target.value }))}
            >
              {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {BOOLEAN_FIELDS.map((f) => (
              <button
                key={f.key}
                onClick={() => toggle(f.key)}
                className={`flex items-center justify-between rounded-lg border px-3 py-2 text-sm transition ${
                  fields[f.key]
                    ? 'border-emerald-500/40 bg-emerald-500/10 text-foreground'
                    : 'border-border bg-white/5 text-muted-foreground'
                }`}
              >
                {f.label}
                <span className={`flex h-5 w-5 items-center justify-center rounded-full ${fields[f.key] ? 'bg-emerald-500 text-white' : 'bg-muted'}`}>
                  {fields[f.key] && <Check className="h-3 w-3" />}
                </span>
              </button>
            ))}
          </div>

          <div>
            <label className="text-sm font-semibold">Legal review reference</label>
            <input
              className="c53-input mt-1"
              placeholder="Advice document reference / date"
              value={fields.legal_review_reference}
              onChange={(e) => setFields((p) => ({ ...p, legal_review_reference: e.target.value }))}
            />
          </div>

          <div>
            <label className="text-sm font-semibold">Gate notes</label>
            <textarea
              className="c53-input mt-1 min-h-[80px]"
              placeholder="Internal notes for this gate…"
              value={fields.gate_notes}
              onChange={(e) => setFields((p) => ({ ...p, gate_notes: e.target.value }))}
            />
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-semibold">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={fields.launch_blocked}
                disabled={gate.launch_blocked !== false && !allClear}
                onChange={(e) => setFields((p) => ({ ...p, launch_blocked: e.target.checked }))}
              />
              Launch blocked
            </label>
            {gate.launch_blocked !== false && !allClear && (
              <p className="mt-1 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-600">
                Cannot clear launch_blocked until all conditions are met. Missing: {unmetConditions(fields).join(', ')}.
              </p>
            )}
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
            {missing.length > 0 && <div className="mt-1 text-xs">Missing: {missing.join(', ')}</div>}
          </div>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-semibold text-muted-foreground hover:bg-muted">
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg grad-bg px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save changes
          </button>
        </div>
      </div>
    </div>
  );
}