import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { adminChallengeApi } from '@/lib/adminChallengeApi';
import { LEVELS } from './panelMeta';

export default function AddJudgeDialog({ open, onOpenChange, challengeId, challengeCategory, actingEmail, onAdded }) {
  const [form, setForm] = useState({ name: '', email: '', level: 'state', invite: true });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm({ ...form, [k]: v });

  const submit = async () => {
    if (!form.name.trim()) { setError('Give the judge a name.'); return; }
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) { setError('Enter a valid email address.'); return; }
    setSaving(true);
    setError('');
    try {
      const res = await adminChallengeApi.judgePanelAddJudge({
        challengeId,
        name: form.name.trim(),
        email: form.email.trim(),
        level: form.level,
        invite: form.invite,
        actingEmail,
      });
      // The roster record can be created while the invitation itself is refused
      // (for example the judge has entered this challenge). Keep the dialog open
      // and say so, rather than reporting a clean success.
      if (res?.invite_error) {
        setError(`Added to the roster, but the invitation was refused: ${res.invite_error.message || res.invite_error}`);
        return;
      }
      onAdded?.();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add a new judge</DialogTitle>
          <DialogDescription>
            Creates the roster record with this challenge's category
            {challengeCategory ? ` (${String(challengeCategory).replace(/[_-]/g, ' ')})` : ''} as their discipline.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label htmlFor="aj-name" className="mb-1.5 block text-sm font-semibold">Full name</label>
            <input id="aj-name" className="c53-input" value={form.name} onChange={(e) => set('name', e.target.value)} />
          </div>
          <div>
            <label htmlFor="aj-email" className="mb-1.5 block text-sm font-semibold">Email</label>
            <input id="aj-email" className="c53-input" value={form.email} onChange={(e) => set('email', e.target.value)} />
          </div>
          <div>
            <label htmlFor="aj-level" className="mb-1.5 block text-sm font-semibold">Level</label>
            <select id="aj-level" className="c53-input" value={form.level} onChange={(e) => set('level', e.target.value)}>
              {LEVELS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input type="checkbox" checked={form.invite} onChange={(e) => set('invite', e.target.checked)} />
            Invite them to this panel straight away
          </label>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>{saving ? 'Saving…' : 'Add judge'}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}