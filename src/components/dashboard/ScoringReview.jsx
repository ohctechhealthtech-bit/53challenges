import { useEffect, useState } from 'react';
import { Loader2, ShieldAlert, BarChart3, Gavel } from 'lucide-react';
import { loadAdminOverview } from '@/lib/judgeScoring';
import ComplianceFlagQueue from '@/components/dashboard/ComplianceFlagQueue';
import PanelProgressList from '@/components/dashboard/PanelProgressList';
import ScoringConsole from '@/components/judging/ScoringConsole';

// Admin scoring view: panel progress, the compliance-flag queue, and — for
// administrators who also hold an active judge profile — their own score sheet.
export default function ScoringReview() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [view, setView] = useState('overview');

  const load = async () => {
    setLoading(true);
    try {
      setData(await loadAdminOverview());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>;
  if (error) return <p className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p>;

  const openFlags = data?.flags || [];

  return (
    <div>
      <div className="inline-flex rounded-xl border border-border bg-card p-1">
        <Btn active={view === 'overview'} onClick={() => setView('overview')}><BarChart3 className="h-4 w-4" /> Progress</Btn>
        <Btn active={view === 'flags'} onClick={() => setView('flags')}>
          <ShieldAlert className="h-4 w-4" /> Compliance
          {openFlags.length > 0 && <span className="ml-1 rounded-full bg-amber-500 px-1.5 text-[10px] font-bold text-white">{openFlags.length}</span>}
        </Btn>
        <Btn active={view === 'score'} onClick={() => setView('score')}><Gavel className="h-4 w-4" /> My scoring</Btn>
      </div>

      <div className="mt-6">
        {view === 'overview' && <PanelProgressList progress={data?.progress || []} />}
        {view === 'flags' && <ComplianceFlagQueue flags={openFlags} onResolved={load} />}
        {view === 'score' && <ScoringConsole />}
      </div>
    </div>
  );
}

function Btn({ active, onClick, children }) {
  return (
    <button onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}>
      {children}
    </button>
  );
}