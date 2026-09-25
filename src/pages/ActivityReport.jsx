import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { BarChart3, Loader2 } from 'lucide-react';
import TodayBatchTable from '@/components/reporting/TodayBatchTable';
import CategoryActivityTable from '@/components/reporting/CategoryActivityTable';
import ChallengeEntriesTable from '@/components/reporting/ChallengeEntriesTable';

export default function ActivityReport() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await base44.functions.invoke('activityReport', {});
        const payload = res && res.data !== undefined ? res.data : res;
        if (payload?.error) throw new Error(payload.error);
        setData(payload);
      } catch (e) {
        setError(e.message || 'Could not load the report');
      }
    })();
  }, []);

  return (
    <div className="container-tight py-10">
      <div className="flex items-center gap-3">
        <BarChart3 className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">Entry Activity Report</h1>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">Entries per challenge, and which categories are attracting the most activity.</p>

      {error && <p className="mt-6 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p>}

      {!data && !error && (
        <div className="mt-10 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading report…
        </div>
      )}

      {data && (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <Stat label="Challenges" value={data.totals.challenges} />
            <Stat label="Total entries" value={data.totals.entries} />
            <Stat label="Challenges with entries" value={data.totals.challengesWithEntries} />
          </div>
          <TodayBatchTable rows={data.batches || []} />
          <CategoryActivityTable rows={data.categories} />
          <ChallengeEntriesTable rows={data.challenges} />
        </>
      )}
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  );
}