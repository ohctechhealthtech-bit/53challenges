/**
 * Add or edit a judge in the judges master (upsert by email).
 */
import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

const BLANK = { name: '', email: '', disciplines: [], level: 'state', active: true };

export default function JudgeMasterForm({ judge, options, onSave, onCancel }) {
  const [form, setForm] = useState(BLANK);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setForm(judge ? { ...BLANK, ...judge, disciplines: judge.disciplines || [] } : BLANK);
  }, [judge]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const toggle = (d) =>
    set('disciplines', form.disciplines.includes(d) ? form.disciplines.filter((x) => x !== d) : [...form.disciplines, d]);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.name.trim() || !form.email.includes('@')) { setError('Name and a valid email are required.'); return; }
    setSaving(true);
    try {
      await onSave({
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        disciplines: form.disciplines,
        level: form.level,
        active: !!form.active,
      });
    } catch (err) {
      setError(err.message || 'Could not save this judge.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="rounded-2xl border border-border bg-card p-5">
      <h3 className="font-heading text-base font-bold">{judge ? 'Edit judge' : 'Add a judge'}</h3>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="jm-name" className="mb-1 block text-sm font-semibold">Full name</label>
          <input id="jm-name" className="c53-input" value={form.name} onChange={(e) => set('name', e.target.value)} />
        </div>
        <div>
          <label htmlFor="jm-email" className="mb-1 block text-sm font-semibold">Email</label>
          <input id="jm-email" type="email" className="c53-input" value={form.email} onChange={(e) => set('email', e.target.value)} disabled={!!judge} />
        </div>
        <div>
          <label htmlFor="jm-level" className="mb-1 block text-sm font-semibold">Level</label>
          <select id="jm-level" className="c53-input" value={form.level} onChange={(e) => set('level', e.target.value)}>
            {(options?.levels || ['state', 'national', 'overall']).map((l) => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
        </div>
        <div className="flex items-end">
          <label className="inline-flex items-center gap-2 text-sm font-semibold">
            <input type="checkbox" checked={!!form.active} onChange={(e) => set('active', e.target.checked)} />
            Active
          </label>
        </div>
      </div>

      <div className="mt-4">
        <p className="mb-2 text-sm font-semibold">Disciplines</p>
        <div className="flex flex-wrap gap-2">
          {(options?.categories || []).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => toggle(d)}
              className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${form.disciplines.includes(d) ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-muted'}`}
            >
              {d.replace(/_/g, ' ')}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

      <div className="mt-5 flex gap-3">
        <Button type="submit" disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {judge ? 'Save changes' : 'Add judge'}
        </Button>
        {onCancel && <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>}
      </div>
    </form>
  );
}