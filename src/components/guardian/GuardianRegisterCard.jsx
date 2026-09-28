import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, ShieldCheck } from 'lucide-react';

export default function GuardianRegisterCard({ guardian, onSaved }) {
  const [form, setForm] = useState({
    name: guardian?.name || '',
    relationship: guardian?.relationship || '',
    mobile: guardian?.mobile || '',
    address: guardian?.address || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const res = await base44.functions.invoke('guardianPortal', { action: 'register', ...form });
      if (res?.data?.error) {
        setError(res.data.error);
        return;
      }
      onSaved?.();
    } catch (e) {
      // There was no catch here at all: a failed registration stopped the
      // spinner and said nothing, so a parent believed they had registered
      // while their child's entry stayed blocked waiting for them.
      setError(e?.response?.data?.error || 'Could not save your details. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <p className="flex items-center gap-2 font-heading text-sm font-bold">
        <ShieldCheck className="h-4 w-4 text-primary" /> {guardian ? 'Your guardian details' : 'Register as a guardian'}
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Input placeholder="Your full name" aria-label="Full name" value={form.name} onChange={(e) => set('name', e.target.value)} />
        <Input placeholder="Relationship (e.g. Mother)" aria-label="Relationship" value={form.relationship} onChange={(e) => set('relationship', e.target.value)} />
        <Input placeholder="Mobile number" aria-label="Mobile" value={form.mobile} onChange={(e) => set('mobile', e.target.value)} />
        <Input placeholder="Address" aria-label="Address" value={form.address} onChange={(e) => set('address', e.target.value)} />
      </div>
      <Button className="mt-4" onClick={save} disabled={saving || form.name.trim().length < 2}>
        {saving && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
        {guardian ? 'Update details' : 'Register'}
      </Button>
      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
    </div>
  );
}