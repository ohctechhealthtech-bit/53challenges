import { useEffect, useState } from 'react';
import { Loader2, ShieldCheck } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { getSessionToken } from '@/lib/appSession';
import { useToast } from '@/components/ui/use-toast';
import ContentApprovalCard from './ContentApprovalCard';

/** Group entries by their challenge title, preserving queue order. */
function groupByChallenge(items) {
  const groups = [];
  for (const e of items) {
    const title = e.challenge_title || 'Challenge';
    let g = groups.find((x) => x.title === title);
    if (!g) { g = { title, entries: [] }; groups.push(g); }
    g.entries.push(e);
  }
  return groups;
}

/** Content awaiting approval. scope: 'admin' (all) or 'host' (own challenges). */
export default function ContentApprovalQueue({ scope = 'admin', onCountChange }) {
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState({ is_admin: false, is_host: false });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await base44.functions.invoke('moderateSubmission', { action: 'queue', session_token: getSessionToken() });
      if (res.data?.error) { setError(res.data.error); return; }
      const list = res.data?.entries || [];
      setItems(list);
      setMeta({ is_admin: !!res.data?.is_admin, is_host: !!res.data?.is_host });
      onCountChange?.(list.length);
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || 'Could not load the review queue.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [scope]);

  const remove = (id, decision) => {
    setItems((list) => {
      const next = list.filter((x) => x.id !== id);
      onCountChange?.(next.length);
      return next;
    });
    toast({
      title: decision === 'approve' ? 'Entry approved' : 'Entry rejected',
      description: decision === 'approve'
        ? "It's now visible publicly and the participant has been emailed."
        : 'The participant has been emailed your feedback.',
    });
  };

  const groups = groupByChallenge(items);

  // Hosts who review nothing themselves (the 53 team manages their challenges)
  // don't need this panel at all.
  if (!loading && !error && !items.length && !meta.is_admin && !meta.is_host) return null;

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-heading text-lg font-bold">
            <ShieldCheck className="h-5 w-5 text-primary" /> Pending review
            {items.length > 0 && (
              <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-bold text-primary-foreground">{items.length}</span>
            )}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Nothing is publicly visible until it's approved here.
          </p>
        </div>
      </div>

      {error && <p className="mt-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

      {loading ? (
        <div className="py-10 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : items.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          {!meta.is_admin && !meta.is_host
            ? "You don't have any challenges where you review the entries yourself. The 53 team reviews entries for challenges they manage."
            : 'Nothing waiting for review right now.'}
        </p>
      ) : groups.length > 1 ? (
        <div className="mt-4 space-y-6">
          {groups.map((g) => (
            <div key={g.title}>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {g.title} · {g.entries.length}
              </h3>
              <div className="space-y-3">
                {g.entries.map((e) => (
                  <ContentApprovalCard key={e.id} entry={e} onDecided={(d) => remove(e.id, d)} />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {items.map((e) => (
            <ContentApprovalCard key={e.id} entry={e} onDecided={(d) => remove(e.id, d)} />
          ))}
        </div>
      )}
    </section>
  );
}