import { useEffect, useState } from 'react';
import { Loader2, Link2, Check, X } from 'lucide-react';
import { listAccounts, saveAccount, deleteAccount, PROMO_PLATFORMS } from '@/lib/participantPromo';

export default function PromoAccounts() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState('');
  const [handle, setHandle] = useState('');
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    const d = await listAccounts();
    setAccounts(d?.accounts || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const connect = async (e) => {
    e.preventDefault();
    setBusy(true);
    await saveAccount({ platform: editing, handle, profile_url: url });
    setEditing(''); setHandle(''); setUrl(''); setBusy(false);
    load();
  };

  const byPlatform = Object.fromEntries(accounts.map((a) => [a.platform, a]));

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-heading text-xl font-bold">Your social accounts</h2>
        <p className="mt-1 text-sm text-muted-foreground">Link the profiles you post from. We use them to tailor your posts and give you one-tap sharing.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {PROMO_PLATFORMS.map((pl) => {
          const acc = byPlatform[pl.k];
          return (
            <div key={pl.k} className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold">{pl.l}</p>
                {acc ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-semibold text-emerald-300"><Check className="h-3 w-3" /> Linked</span>
                ) : (
                  <span className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">Not linked</span>
                )}
              </div>
              {acc && <p className="mt-1 truncate text-xs text-muted-foreground">{acc.handle || acc.profile_url}</p>}
              <div className="mt-3 flex gap-2">
                <button onClick={() => { setEditing(pl.k); setHandle(acc?.handle || ''); setUrl(acc?.profile_url || ''); }} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:border-primary/40">
                  <Link2 className="h-3.5 w-3.5" /> {acc ? 'Edit' : 'Link account'}
                </button>
                {acc && <button onClick={async () => { await deleteAccount(acc.id); load(); }} className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs text-destructive hover:underline"><X className="h-3.5 w-3.5" /> Unlink</button>}
              </div>
              {editing === pl.k && (
                <form onSubmit={connect} className="mt-3 space-y-2">
                  <input className="c53-input text-sm" placeholder="@yourhandle" value={handle} onChange={(e) => setHandle(e.target.value)} />
                  <input className="c53-input text-sm" placeholder="Profile link (optional)" value={url} onChange={(e) => setUrl(e.target.value)} />
                  <button disabled={busy} className="w-full rounded-lg grad-bg px-3 py-2 text-xs font-bold text-white disabled:opacity-60">{busy ? 'Saving…' : 'Save'}</button>
                </form>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}