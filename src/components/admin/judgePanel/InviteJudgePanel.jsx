import { useState } from 'react';
import { UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { adminChallengeApi } from '@/lib/adminChallengeApi';
import { prettyList } from './panelMeta';

export default function InviteJudgePanel({ challengeId, judges, actingEmail, onInvited, onAddNew }) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const available = (judges || []).filter((j) => !j.already_on_panel);
  const chosen = available.find((j) => j.email === email);

  const invite = async () => {
    if (!email) { setError('Choose a judge to invite.'); return; }
    setSaving(true);
    setError('');
    try {
      await adminChallengeApi.judgePanelAssign({ challengeId, judgeEmail: email, actingEmail });
      setEmail('');
      onInvited?.();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="mt-5 rounded-2xl border border-border bg-card/60 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-heading text-base font-bold">
          Invite a judge
          <span className="ml-2 text-sm font-normal text-muted-foreground">{available.length} available on the roster</span>
        </h3>
        <Button variant="outline" size="sm" onClick={onAddNew}>
          <UserPlus className="h-4 w-4" /> Add new judge
        </Button>
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-2">
        <div className="min-w-[280px] flex-1">
          <label htmlFor="ij-judge" className="mb-1.5 block text-sm font-semibold">Roster judge</label>
          <select id="ij-judge" className="c53-input" value={email} onChange={(e) => { setEmail(e.target.value); setError(''); }}>
            <option value="">Choose a judge</option>
            {available.map((j) => (
              <option key={j.id} value={j.email}>{j.option_label || `${j.name} · ${j.email}`}</option>
            ))}
          </select>
        </div>
        <Button onClick={invite} disabled={!email || saving}>{saving ? 'Sending…' : 'Send invitation'}</Button>
      </div>

      {chosen && (
        <p className="mt-2 text-sm text-muted-foreground">
          {chosen.email} · {chosen.level} level · judges {prettyList(chosen.disciplines)}
        </p>
      )}
      {available.length === 0 && (
        <p className="mt-2 text-sm text-muted-foreground">Everyone on the roster is already on this panel.</p>
      )}
      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
    </section>
  );
}