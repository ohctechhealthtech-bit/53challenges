import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { adminChallengeApi } from '@/lib/adminChallengeApi';
import { reasonLabel } from './exclusionsMeta';

export default function AddExclusionForm({ reasons = [], actingEmail, onAdded }) {
  const [email, setEmail] = useState('');
  const [reason, setReason] = useState('organiser');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) { setError('Enter a valid email address.'); return; }
    setSaving(true);
    setError('');
    try {
      await adminChallengeApi.addExclusion({ email: email.trim(), reason, actingEmail });
      setEmail('');
      onAdded?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="mt-5 rounded-2xl border border-border bg-card/60 p-5">
      <h3 className="font-heading text-base font-bold">Add someone to the list</h3>
      <div className="mt-4 flex flex-wrap items-end gap-3">
        <div className="min-w-[260px] flex-1">
          <label htmlFor="ex-email" className="mb-1.5 block text-sm font-semibold">Email address</label>
          <input
            id="ex-email"
            className="c53-input"
            placeholder="person@example.com"
            value={email}
            onChange={(ev) => { setEmail(ev.target.value); setError(''); }}
          />
        </div>
        <div className="min-w-[200px]">
          <label htmlFor="ex-reason" className="mb-1.5 block text-sm font-semibold">Reason</label>
          <select id="ex-reason" className="c53-input" value={reason} onChange={(ev) => setReason(ev.target.value)}>
            {(reasons.length ? reasons : ['organiser']).map((r) => (
              <option key={r} value={r}>{reasonLabel(r)}</option>
            ))}
          </select>
        </div>
        <Button type="submit" disabled={saving}>{saving ? 'Adding…' : 'Add to list'}</Button>
      </div>
      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
    </form>
  );
}