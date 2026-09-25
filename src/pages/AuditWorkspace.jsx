import { useEffect, useState } from 'react';
import { Loader2, ScrollText } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { listCompetitions, getAuditReview, getFindings, getPrizeLedger, getPayouts, REVIEW_STATUS } from '@/lib/audit';
import PreLaunchCard from '@/components/audit/PreLaunchCard';
import CloseAuditCard from '@/components/audit/CloseAuditCard';
import FindingsPanel from '@/components/audit/FindingsPanel';
import PrizeLedgerCard from '@/components/audit/PrizeLedgerCard';
import PayoutsTable from '@/components/audit/PayoutsTable';

export default function AuditWorkspace() {
  const { user, isAuthenticated } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [comps, setComps] = useState([]);
  const [selId, setSelId] = useState('');
  const [review, setReview] = useState(null);
  const [findings, setFindings] = useState([]);
  const [ledger, setLedger] = useState(null);
  const [payouts, setPayouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rel, setRel] = useState(0);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const list = await listCompetitions();
      setComps(list);
      if (list[0]) setSelId(list[0].id);
      setLoading(false);
    })();
  }, []);

  const reload = async (id = selId) => {
    if (!id) return;
    const [r, lg, pos] = await Promise.all([
      getAuditReview(id), getPrizeLedger(id), getPayouts(id),
    ]);
    setReview(r); setLedger(lg); setPayouts(pos || []);
    if (r) setFindings(await getFindings(r.id)); else setFindings([]);
  };

  useEffect(() => { reload(selId); }, [selId, rel]);

  if (!isAuthenticated) return <div className="container-tight py-24 text-center text-muted-foreground">Sign in to access the audit workspace.</div>;
  if (!isAdmin) return (
    <div className="container-tight py-24 text-center">
      <p className="text-muted-foreground">Audit workspace is restricted to platform admins and assigned auditors.</p>
      <p className="mt-1 text-sm text-muted-foreground">Auditors are assigned per competition via the Judges module (role: auditor).</p>
    </div>
  );

  const status = review?.status || 'not_started';
  const st = REVIEW_STATUS[status] || REVIEW_STATUS.not_started;
  const auditSignedOff = status === 'signed_off';
  const reviewWithFindings = review ? { ...review, _findings: findings } : null;

  return (
    <div className="container-tight py-10">
      <div className="flex items-center gap-2">
        <ScrollText className="h-7 w-7 text-purple-400" />
        <h1 className="font-heading text-3xl font-extrabold">Audit & Prize Control</h1>
      </div>
      <p className="mt-2 text-muted-foreground">Independent audit per competition: pre-launch terms check, closed-competition recompute, findings, two-person prize release.</p>

      {/* Competition picker */}
      <div className="mt-6 flex items-center gap-3">
        {loading ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /> : (
          <select value={selId} onChange={(e) => setSelId(e.target.value)} className="flex-1 rounded-xl border border-input bg-white/5 px-3 py-2.5 text-sm">
            {comps.map((c) => <option key={c.id} value={c.id}>{c.title || c.theme}</option>)}
          </select>
        )}
        {review && (
          <span className={`rounded-full px-3 py-1.5 text-xs font-bold ${st.tone} bg-card border border-border`}>{st.label}</span>
        )}
      </div>

      {selId && (
        <div className="mt-6 grid gap-5 lg:grid-cols-2">
          <PreLaunchCard review={review} competitionId={selId} onChanged={() => setRel((n) => n + 1)} />
          <PrizeLedgerCard ledger={ledger} competitionId={selId} auditSignedOff={auditSignedOff} onChanged={() => setRel((n) => n + 1)} />
          <CloseAuditCard review={review} competitionId={selId} isAdmin={isAdmin} onChanged={() => setRel((n) => n + 1)} />
          <FindingsPanel review={reviewWithFindings} competitionId={selId} onChanged={() => setRel((n) => n + 1)} />
          <div className="lg:col-span-2">
            <PayoutsTable payouts={payouts} isAdmin={isAdmin} onChanged={() => setRel((n) => n + 1)} />
          </div>
        </div>
      )}
    </div>
  );
}