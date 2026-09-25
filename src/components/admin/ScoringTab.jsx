import { useCallback, useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import SectionToolbar from '@/components/admin/SectionToolbar';
import ScoringSummary from '@/components/admin/scoring/ScoringSummary';
import ScoringTable from '@/components/admin/scoring/ScoringTable';
import ScoreEditDialog from '@/components/admin/scoring/ScoreEditDialog';
import TieResolveDialog from '@/components/admin/scoring/TieResolveDialog';
import JudgeProgressPanel from '@/components/admin/scoring/JudgeProgressPanel';
import ScrutineerPanel from '@/components/admin/scoring/ScrutineerPanel';
import { adminChallengeApi } from '@/lib/adminChallengeApi';

export default function ScoringTab({ challengeId, actingEmail }) {
  const [board, setBoard] = useState(null);
  const [panel, setPanel] = useState(null);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editRow, setEditRow] = useState(null);
  const [tieRow, setTieRow] = useState(null);
  const [busy, setBusy] = useState('');

  const load = useCallback(async () => {
    if (!challengeId) { setBoard(null); setPanel(null); setLoading(false); return; }
    setLoading(true);
    setError('');
    try {
      const [b, p] = await Promise.all([
        adminChallengeApi.scoringBoard({ challengeId, ...(query ? { search: query } : {}) }),
        adminChallengeApi.scoringJudges({ challengeId }),
      ]);
      setBoard(b);
      setPanel(p);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [challengeId, query]);

  useEffect(() => { load(); }, [load]);

  const runOperation = async (operation) => {
    setBusy(operation);
    setError('');
    try {
      await adminChallengeApi.updateScoring({ challengeId, operation, actingEmail });
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy('');
    }
  };

  if (!challengeId) {
    return (
      <>
        <SectionToolbar section="scoring" title="Judge scoring" description="Choose a challenge to see its scoring board." />
        <p className="mt-4 text-sm text-muted-foreground">Pick a challenge above to load its scores.</p>
      </>
    );
  }

  const rows = board?.entries || [];
  const judges = (panel?.judges || []).filter((j) => j.can_score !== false);

  return (
    <>
      <SectionToolbar
        section="scoring"
        title="Judge scoring"
        description="Every submission with each judge's breakdown, how far the panel has got, and the decisions only an admin can make."
      />

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <form className="flex items-center gap-2" onSubmit={(e) => { e.preventDefault(); setQuery(search.trim()); }}>
          <label htmlFor="sc-search" className="sr-only">Search submissions</label>
          <input
            id="sc-search"
            className="c53-input w-60"
            placeholder="Search title or entrant"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button type="submit" className="rounded-lg bg-muted p-2.5 text-muted-foreground hover:text-foreground" aria-label="Search">
            <Search className="h-4 w-4" />
          </button>
        </form>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => runOperation('recompute')} disabled={!!busy || loading}>
            {busy === 'recompute' ? 'Recomputing…' : 'Recompute scores'}
          </Button>
          <Button
            variant="outline"
            onClick={() => runOperation('migrate_legacy')}
            disabled={!board?.has_unmigrated_legacy || !!busy || loading}
          >
            {busy === 'migrate_legacy' ? 'Migrating…' : 'Migrate legacy scores'}
          </Button>
        </div>
      </div>

      {error && <p className="mt-4 text-sm text-destructive">{error}</p>}

      <ScoringSummary board={board} />

      <section className="mt-5 rounded-2xl border border-border bg-card/60 p-5">
        <h3 className="font-heading text-base font-bold">
          Submissions
          <span className="ml-2 text-sm font-normal text-muted-foreground">{rows.length}</span>
        </h3>
        {loading ? (
          <p className="mt-4 text-sm text-muted-foreground">Loading the scoring board…</p>
        ) : (
          <ScoringTable
            rows={rows}
            locked={!!board?.scores_locked}
            onEdit={setEditRow}
            onResolveTie={setTieRow}
          />
        )}
      </section>

      <JudgeProgressPanel data={panel} loading={loading} />

      <ScrutineerPanel challengeId={challengeId} actingEmail={actingEmail} />

      {editRow && (
        <ScoreEditDialog
          key={editRow.entry_id}
          open={!!editRow}
          onOpenChange={(v) => !v && setEditRow(null)}
          challengeId={challengeId}
          row={editRow}
          judges={judges}
          actingEmail={actingEmail}
          onSaved={async () => { setEditRow(null); await load(); }}
        />
      )}

      {tieRow && (
        <TieResolveDialog
          key={tieRow.entry_id}
          open={!!tieRow}
          onOpenChange={(v) => !v && setTieRow(null)}
          challengeId={challengeId}
          row={tieRow}
          actingEmail={actingEmail}
          onResolved={async () => { setTieRow(null); await load(); }}
        />
      )}
    </>
  );
}