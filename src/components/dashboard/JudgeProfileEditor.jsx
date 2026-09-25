import { useState } from 'react';
import { Loader2, X, Trash2, Plus } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import {
  JUDGE_CATEGORIES, STATUS_LABELS, STATUS_FLOW, COI_TYPES, wwccCurrent,
} from '@/lib/judges';

const WWCC_STATUSES = ['none', 'applied', 'current', 'expired'];

export default function JudgeProfileEditor({ profile, onClose, onSaved }) {
  const [form, setForm] = useState({
    ...profile,
    approved_categories: profile.approved_categories || [],
    conflict_of_interest: profile.conflict_of_interest || [],
    wwcc_status: profile.wwcc_status || 'none',
    wwcc_number: profile.wwcc_number || '',
    wwcc_expiry: profile.wwcc_expiry ? profile.wwcc_expiry.slice(0, 10) : '',
    credential_notes: profile.credential_notes || '',
    agreement_signed: !!profile.agreement_signed,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [coiType, setCoiType] = useState('club');
  const [coiName, setCoiName] = useState('');

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const toggleCat = (c) => set('approved_categories', form.approved_categories.includes(c)
    ? form.approved_categories.filter((x) => x !== c) : [...form.approved_categories, c]);

  const addCoi = () => {
    if (!coiName.trim()) return;
    set('conflict_of_interest', [...form.conflict_of_interest, { type: coiType, name: coiName.trim() }]);
    setCoiName('');
  };
  const removeCoi = (idx) => set('conflict_of_interest', form.conflict_of_interest.filter((_, i) => i !== idx));

  const save = async () => {
    setError('');
    setSaving(true);
    try {
      const patch = {
        status: form.status,
        approved_categories: form.approved_categories,
        credential_notes: form.credential_notes,
        wwcc_status: form.wwcc_status,
        wwcc_number: form.wwcc_number,
        wwcc_expiry: form.wwcc_expiry || '',
        conflict_of_interest: form.conflict_of_interest,
        agreement_signed: form.agreement_signed,
      };
      if (form.agreement_signed && !profile.agreement_signed) {
        patch.agreement_signed_at = new Date().toISOString();
      }
      const updated = await base44.entities.JudgeProfile.update(profile.id, patch);
      onSaved?.({ ...profile, ...patch, ...updated });
    } catch (e) {
      setError(e?.message || 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-border bg-card p-6 sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-heading text-xl font-extrabold">{profile.name}</h3>
            <p className="text-xs text-muted-foreground">{profile.email}{profile.state ? ` · ${profile.state}` : ''}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-muted"><X className="h-5 w-5" /></button>
        </div>

        {error && <p className="mt-3 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

        <Section title="Status">
          <div className="flex flex-wrap gap-2">
            {STATUS_FLOW.map((s) => (
              <button key={s} onClick={() => set('status', s)}
                className={`rounded-lg border px-3 py-1.5 text-sm font-semibold ${form.status === s ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-white/5 hover:bg-muted'}`}>
                {STATUS_LABELS[s]}
              </button>
            ))}
          </div>
          {form.status !== 'active' && <p className="mt-1.5 text-xs text-amber-400">Only Active judges can be assigned to competitions.</p>}
        </Section>

        <Section title="Approved categories">
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {JUDGE_CATEGORIES.map((c) => (
              <button key={c} onClick={() => toggleCat(c)}
                className={`rounded-lg border px-3 py-2 text-left text-sm ${form.approved_categories.includes(c) ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-white/5'}`}>
                {form.approved_categories.includes(c) ? '✓ ' : ''}{c}
              </button>
            ))}
          </div>
        </Section>

        <Section title="Working With Children Check">
          <div className="grid gap-2 sm:grid-cols-3">
            <select value={form.wwcc_status} onChange={(e) => set('wwcc_status', e.target.value)} className="rounded-lg border border-input bg-white/5 px-3 py-2 text-sm">
              {WWCC_STATUSES.map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
            </select>
            <input value={form.wwcc_number} onChange={(e) => set('wwcc_number', e.target.value)} placeholder="WWCC number"
              className="rounded-lg border border-input bg-white/5 px-3 py-2 text-sm" />
            <input type="date" value={form.wwcc_expiry} onChange={(e) => set('wwcc_expiry', e.target.value)}
              className="rounded-lg border border-input bg-white/5 px-3 py-2 text-sm" />
          </div>
          {form.wwcc_status === 'current' && form.wwcc_expiry && !wwccCurrent(form) && (
            <p className="mt-1.5 text-xs text-amber-400">This WWCC has passed its expiry date and is not current.</p>
          )}
        </Section>

        <Section title="Judge agreement">
          <label className="flex items-center gap-2.5 rounded-lg border border-border bg-white/5 px-3 py-2.5">
            <input type="checkbox" checked={form.agreement_signed} onChange={(e) => set('agreement_signed', e.target.checked)} className="h-4 w-4 accent-primary" />
            <span className="text-sm">Signed judge agreement on file</span>
          </label>
        </Section>

        <Section title="Conflict-of-interest register">
          <div className="space-y-1.5">
            {form.conflict_of_interest.map((c, idx) => (
              <div key={idx} className="flex items-center justify-between rounded-lg border border-border bg-white/5 px-3 py-2">
                <span className="text-sm"><span className="font-semibold capitalize">{c.type}:</span> {c.name}</span>
                <button onClick={() => removeCoi(idx)} className="rounded p-1 text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}
          </div>
          <div className="mt-2 flex gap-2">
            <select value={coiType} onChange={(e) => setCoiType(e.target.value)} className="rounded-lg border border-input bg-white/5 px-2 py-2 text-sm">
              {COI_TYPES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
            <input value={coiName} onChange={(e) => setCoiName(e.target.value)} placeholder="Name of club / school / workplace / person"
              className="flex-1 rounded-lg border border-input bg-white/5 px-3 py-2 text-sm" />
            <button onClick={addCoi} className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-sm font-bold text-primary-foreground"><Plus className="h-4 w-4" /></button>
          </div>
        </Section>

        <Section title="Credential notes">
          <textarea value={form.credential_notes} onChange={(e) => set('credential_notes', e.target.value)} rows={2}
            className="w-full rounded-lg border border-input bg-white/5 px-3 py-2 text-sm" placeholder="Qualifications, references, admin notes…" />
        </Section>

        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-xl border border-border px-4 py-2 text-sm font-semibold hover:bg-muted">Close</button>
          <button onClick={save} disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl grad-bg px-5 py-2 text-sm font-bold text-white disabled:opacity-50">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Save profile
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="mt-5">
      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">{title}</p>
      {children}
    </div>
  );
}