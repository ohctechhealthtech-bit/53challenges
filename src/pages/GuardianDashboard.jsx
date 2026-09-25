import { useCallback, useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2 } from 'lucide-react';
import GuardianRegisterCard from '@/components/guardian/GuardianRegisterCard';
import GuardianRequestCard from '@/components/guardian/GuardianRequestCard';
import GuardianChildrenPanel from '@/components/guardian/GuardianChildrenPanel';
import GuardianActivityList from '@/components/guardian/GuardianActivityList';

export default function GuardianDashboard() {
  const [loading, setLoading] = useState(true);
  const [guardian, setGuardian] = useState(null);
  const [children, setChildren] = useState([]);
  const [requests, setRequests] = useState([]);
  const [entries, setEntries] = useState([]);

  const load = useCallback(async () => {
    const [meRes, reqRes, actRes] = await Promise.all([
      base44.functions.invoke('guardianPortal', { action: 'me' }),
      base44.functions.invoke('guardianPortal', { action: 'list_requests' }),
      base44.functions.invoke('guardianPortal', { action: 'activity' }),
    ]);
    setGuardian(meRes.data?.guardian || null);
    setChildren(meRes.data?.children || []);
    setRequests(reqRes.data?.requests || []);
    setEntries(actRes.data?.entries || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const decide = async (request_id, action, reason) => {
    const res = await base44.functions.invoke('guardianPortal', { action, request_id, reason });
    if (res.data?.error) throw new Error(res.data.error);
    await load();
  };

  if (loading) {
    return <div className="flex justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  const pending = requests.filter((r) => r.status === 'pending');
  const history = requests.filter((r) => r.status !== 'pending');

  return (
    <div className="container-tight py-10">
      <h1 className="font-heading text-3xl font-extrabold">Parent / Guardian Dashboard</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Review and approve your children's challenge entries. Entries stay on hold until you approve them.
      </p>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-8">
          <section>
            <h2 className="mb-3 font-heading text-lg font-bold">
              Pending approvals {pending.length > 0 && <span className="ml-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-xs text-amber-300">{pending.length}</span>}
            </h2>
            {pending.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing waiting on you right now.</p>
            ) : (
              <div className="space-y-3">
                {pending.map((r) => <GuardianRequestCard key={r.id} request={r} onDecide={decide} />)}
              </div>
            )}
          </section>

          <section>
            <h2 className="mb-3 font-heading text-lg font-bold">Children's activity</h2>
            <GuardianActivityList entries={entries} />
          </section>

          {history.length > 0 && (
            <section>
              <h2 className="mb-3 font-heading text-lg font-bold">Decision history</h2>
              <div className="space-y-3">
                {history.map((r) => <GuardianRequestCard key={r.id} request={r} onDecide={decide} />)}
              </div>
            </section>
          )}
        </div>

        <div className="space-y-6">
          <GuardianRegisterCard guardian={guardian} onSaved={load} />
          <GuardianChildrenPanel children={children} onChanged={load} />
        </div>
      </div>
    </div>
  );
}