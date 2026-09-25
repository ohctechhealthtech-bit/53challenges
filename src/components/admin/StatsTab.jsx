import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import SectionToolbar from '@/components/admin/SectionToolbar';
import StatsCards from '@/components/admin/stats/StatsCards';
import StatsBreakdown from '@/components/admin/stats/StatsBreakdown';
import StatsDetailTable from '@/components/admin/stats/StatsDetailTable';
import PanelSnapshot from '@/components/admin/stats/PanelSnapshot';
import NeedsAttentionList from '@/components/admin/stats/NeedsAttentionList';
import { adminChallengeApi } from '@/lib/adminChallengeApi';

// Read-only snapshot: one challenge when selected, otherwise the whole platform.
export default function StatsTab({ challengeId, actingEmail }) {
  const [scopeAll, setScopeAll] = useState(false);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const useChallenge = Boolean(challengeId) && !scopeAll;

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(await adminChallengeApi.stats({ ...(useChallenge ? { challengeId } : {}), actingEmail }));
    } catch (e) {
      setError(e.message);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [useChallenge, challengeId, actingEmail]);

  useEffect(() => { load(); }, [load]);

  return (
    <>
      <SectionToolbar
        section="stats"
        title="Stats"
        description="Entries, votes, money and judging at a glance."
        challengeId={useChallenge ? challengeId : undefined}
      />

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          onClick={() => setScopeAll(false)}
          disabled={!challengeId}
          className={`rounded-full px-3 py-1.5 text-xs font-semibold disabled:opacity-50 ${useChallenge ? 'bg-primary text-primary-foreground' : 'border border-border hover:bg-muted'}`}
        >
          Selected challenge
        </button>
        <button
          onClick={() => setScopeAll(true)}
          className={`rounded-full px-3 py-1.5 text-xs font-semibold ${!useChallenge ? 'bg-primary text-primary-foreground' : 'border border-border hover:bg-muted'}`}
        >
          Every challenge
        </button>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Refresh
        </Button>
      </div>

      {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
      {loading && !data && <p className="mt-4 text-sm text-muted-foreground">Loading the numbers…</p>}

      {data && (
        <>
          <p className="mt-4 text-sm text-muted-foreground">
            {data.challenge?.title ? data.challenge.title : 'Across every challenge on the platform'}
          </p>

          <StatsCards cards={data.cards} />
          <NeedsAttentionList items={data.needs_attention} />
          <PanelSnapshot panel={data.panel} />
          <StatsDetailTable counts={data.counts} />

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <StatsBreakdown title="By status" rows={data.by_status} />
            <StatsBreakdown title="By division" rows={data.by_division} />
            <StatsBreakdown title="By entry type" rows={data.by_entry_type} />
            <StatsBreakdown title="By state" rows={data.by_state} />
          </div>
        </>
      )}
    </>
  );
}