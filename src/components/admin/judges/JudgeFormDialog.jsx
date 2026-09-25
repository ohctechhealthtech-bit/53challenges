import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { adminChallengeApi } from '@/lib/adminChallengeApi';
import { LEVELS, DISCIPLINES } from './judgeMeta';

export default function JudgeFormDialog({ open, onOpenChange, judge, onSaved }) {
  const editing = !!judge?.id;
  const [name, setName] = useState(judge?.name || '');
  const [email, setEmail] = useState(judge?.email || '');
  const [level, setLevel] = useState(judge?.level || 'state');
  const [disciplines, setDisciplines] = useState(judge?.disciplines?.length ? judge.disciplines : (judge?.categories || []));
  const [active, setActive] = useState(judge?.active !== false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const toggle = (v) =>
    setDisciplines((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]));

  // The parent requires at least one discipline unless the judge is an overall judge.
  const valid = name.trim() && email.trim() && (level === 'overall' || disciplines.length > 0);

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const payload = { name: name.trim(), email: email.trim(), level, disciplines };
      if (editing) {
        await adminChallengeApi.updateJudge({ id: judge.id, judge: { ...payload, active } });
      } else {
        await adminChallengeApi.createJudge({ judge: payload });
      }
      onSaved?.();
      onOpenChange(false);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit judge' : 'Add judge'}</DialogTitle>
          <DialogDescription>
            Judges on the master roster can be invited to any challenge that matches their expertise.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label htmlFor="jf-name" className="mb-1.5 block text-sm font-semibold">Full name</label>
            <input id="jf-name" className="c53-input" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label htmlFor="jf-email" className="mb-1.5 block text-sm font-semibold">Email</label>
            <input id="jf-email" type="email" className="c53-input" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <label htmlFor="jf-level" className="mb-1.5 block text-sm font-semibold">Judging level</label>
            <select id="jf-level" className="c53-input" value={level} onChange={(e) => setLevel(e.target.value)}>
              {LEVELS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
            </select>
          </div>
          <fieldset>
            <legend className="mb-1.5 text-sm font-semibold">
              Expertise
              <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                {level === 'overall' ? 'optional for overall judges' : 'pick at least one'}
              </span>
            </legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {DISCIPLINES.map((d) => (
                <label key={d.value} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm">
                  <input type="checkbox" checked={disciplines.includes(d.value)} onChange={() => toggle(d.value)} />
                  {d.label}
                </label>
              ))}
            </div>
          </fieldset>
          {editing && (
            <label className="flex items-center gap-2 text-sm font-semibold">
              <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
              Active on the roster
            </label>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={!valid || saving}>
            {saving ? 'Saving…' : editing ? 'Save changes' : 'Add judge'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}