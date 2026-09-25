import { useState } from 'react';
import { Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { adminChallengeApi } from '@/lib/adminChallengeApi';
import { validateInfluence } from './configMeta';

export default function InfluencePanel({ challengeId, influence, actingEmail, onSaved }) {
  const [values, setValues] = useState({ ...influence.values });
  const [error, setError] = useState('');
  const [savedNote, setSavedNote] = useState('');
  const [saving, setSaving] = useState(false);

  const locked = influence.locked;
  const numbers = influence.fields?.numbers || [];
  const toggles = influence.fields?.toggles || [];
  const check = validateInfluence(values);
  const dirty = JSON.stringify(values) !== JSON.stringify(influence.values);

  const set = (k, v) => { setValues({ ...values, [k]: v }); setSavedNote(''); };

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const config = {};
      for (const [k, v] of Object.entries(values)) {
        if (v !== influence.values[k]) config[k] = v;
      }
      await adminChallengeApi.configUpdateInfluence({ challengeId, config, actingEmail });
      setSavedNote('Saved.');
      await onSaved();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="mt-5 rounded-2xl border border-border bg-card/60 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-heading text-base font-bold">Judging & public influence</h3>
          <p className="mt-1 text-sm text-muted-foreground">{influence.formula}</p>
        </div>
        {locked && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-sm">
            <Lock className="h-3.5 w-3.5" /> {influence.lock_reason || 'Locked once the round leaves Draft'}
          </span>
        )}
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {numbers.map((f) => (
          <div key={f.key}>
            <label htmlFor={`inf-${f.key}`} className="mb-1.5 block text-sm font-semibold">{f.label}</label>
            <input
              id={`inf-${f.key}`}
              type="number"
              min="0"
              className="c53-input"
              value={values[f.key] ?? f.default}
              disabled={locked}
              onChange={(e) => set(f.key, e.target.value === '' ? '' : Number(e.target.value))}
            />
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {toggles.map((f) => (
          <label key={f.key} className="flex items-center gap-2 text-sm font-semibold">
            <input
              type="checkbox"
              checked={!!values[f.key]}
              disabled={locked}
              onChange={(e) => set(f.key, e.target.checked)}
            />
            {f.label}
          </label>
        ))}
      </div>

      {!check.valid && (
        <ul className="mt-4 space-y-1">
          {check.messages.map((m) => <li key={m} className="text-sm text-destructive">{m}</li>)}
        </ul>
      )}
      {error && <p className="mt-4 text-sm text-destructive">{error}</p>}

      <div className="mt-4 flex items-center gap-3">
        <Button onClick={save} disabled={locked || saving || !dirty || !check.valid}>
          {saving ? 'Saving…' : 'Save influence settings'}
        </Button>
        {savedNote && <span className="text-sm text-success">{savedNote}</span>}
        {locked && <span className="text-sm text-muted-foreground">This panel is read-only while the round is past Draft.</span>}
      </div>
    </section>
  );
}