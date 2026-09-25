import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Plus, UserRound } from 'lucide-react';

export default function GuardianChildrenPanel({ children, onChanged }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const add = async () => {
    setBusy(true);
    setError('');
    try {
      const res = await base44.functions.invoke('guardianPortal', {
        action: 'link_child', child_name: name.trim(), child_email: email.trim(),
      });
      if (res.data?.error) { setError(res.data.error); return; }
      setName(''); setEmail('');
      onChanged?.();
    } catch (e) {
      setError(e?.response?.data?.error || 'Could not link this child.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <p className="font-heading text-sm font-bold">Linked children</p>
      {children.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">No children linked yet. Children are linked automatically when they enter a challenge, or you can add one below.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {children.map((c) => (
            <li key={c.id} className="flex items-center gap-2 rounded-xl border border-border bg-secondary p-3 text-sm">
              <UserRound className="h-4 w-4 text-primary" />
              <span className="font-semibold">{c.child_name}</span>
              <span className="truncate text-xs text-muted-foreground">{c.child_email}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <Input placeholder="Child's name" aria-label="Child name" value={name} onChange={(e) => setName(e.target.value)} />
        <Input placeholder="Child's email" aria-label="Child email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Button onClick={add} disabled={busy || !name.trim() || !email.trim()}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        </Button>
      </div>
      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
    </div>
  );
}