import { useState } from 'react';
import { Loader2, Check, Bell } from 'lucide-react';
import { addAudienceMember } from '@/lib/marketing';

export default function ComingSoonCard({ item }) {
  const [form, setForm] = useState({ email: '', name: '' });
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    if (!form.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) { setError('Enter a valid email.'); return; }
    setStatus('loading'); setError('');
    try {
      await addAudienceMember({ email: form.email, name: form.name, audience_type: 'creator', categories: [item.subcategory], source: 'coming_soon' });
      setStatus('done');
    } catch (err) {
      setStatus('idle'); setError(err?.message || 'Please log in first.');
    }
  };

  if (status === 'done') return (
    <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4 text-sm text-emerald-300 flex items-center gap-2"><Check className="h-4 w-4" /> You're on the list for {item.subcategory}!</div>
  );

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <span className="rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-bold text-amber-300">Coming soon</span>
      <h3 className="mt-2 font-heading text-lg font-bold">{item.subcategory}</h3>
      <p className="text-xs text-muted-foreground">{item.category}</p>
      <form onSubmit={submit} className="mt-3 grid gap-2 sm:grid-cols-2">
        <input className="c53-input" placeholder="Name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
        <input className="c53-input" type="email" placeholder="Email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
        <button className="sm:col-span-2 inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">{status === 'loading' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />} Expression of interest</button>
      </form>
      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
    </div>
  );
}