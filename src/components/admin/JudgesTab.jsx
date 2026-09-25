import { useCallback, useEffect, useState } from 'react';
import { Plus, Search } from 'lucide-react';
import SectionToolbar from '@/components/admin/SectionToolbar';
import JudgeRosterTable from '@/components/admin/judges/JudgeRosterTable';
import JudgeFormDialog from '@/components/admin/judges/JudgeFormDialog';
import JudgeAssignmentsPanel from '@/components/admin/judges/JudgeAssignmentsPanel';
import JudgeApplicationsPanel from '@/components/admin/judges/JudgeApplicationsPanel';
import JudgeDetailDialog from '@/components/admin/judges/JudgeDetailDialog';
import { adminChallengeApi } from '@/lib/adminChallengeApi';

const STATUS_FILTERS = [
  { value: '', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
];

export default function JudgesTab({ challenges = [], actingEmail, onCounts }) {
  const [judges, setJudges] = useState([]);
  const [counts, setCounts] = useState({});
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formJudge, setFormJudge] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [challengeId, setChallengeId] = useState('');
  const [detailId, setDetailId] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await adminChallengeApi.listJudges({
        ...(status ? { status } : {}),
        ...(query ? { search: query } : {}),
        ...(challengeId ? { challengeId } : {}),
      });
      setJudges(data.judges || []);
      setCounts(data.counts || {});
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [status, query, challengeId]);

  useEffect(() => { load(); }, [load]);

  return (
    <>
      <SectionToolbar
        section="judges"
        title="Judge roster"
        description="Everyone who can score a challenge: the master roster, who is on each challenge panel, and the applications waiting on a decision."
      />

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <div className="flex gap-1 rounded-xl border border-border bg-card p-1">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setStatus(f.value)}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${status === f.value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {f.label}
              {counts[f.value || 'all'] != null && <span className="ml-1.5 text-xs">{counts[f.value || 'all']}</span>}
            </button>
          ))}
        </div>

        <div>
          <label htmlFor="jr-challenge" className="sr-only">Filter by challenge</label>
          <select
            id="jr-challenge"
            className="c53-input w-56"
            value={challengeId}
            onChange={(e) => setChallengeId(e.target.value)}
          >
            <option value="">All challenges</option>
            {challenges.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
        </div>

        <form className="flex items-center gap-2" onSubmit={(e) => { e.preventDefault(); setQuery(search.trim()); }}>
          <label htmlFor="jr-search" className="sr-only">Search judges</label>
          <input
            id="jr-search"
            className="c53-input w-56"
            placeholder="Search name or email"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button type="submit" className="rounded-lg bg-muted p-2.5 text-muted-foreground hover:text-foreground" aria-label="Search">
            <Search className="h-4 w-4" />
          </button>
        </form>

        <button
          onClick={() => { setFormJudge(null); setFormOpen(true); }}
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2.5 text-sm font-semibold text-primary-foreground"
        >
          <Plus className="h-4 w-4" /> Add judge
        </button>
      </div>

      {error && <p className="mt-4 text-sm text-destructive">{error}</p>}

      <JudgeApplicationsPanel onCounts={onCounts} onDecided={load} />

      <section className="mt-5 rounded-2xl border border-border bg-card/60 p-5">
        <h3 className="font-heading text-base font-bold">
          {challengeId ? 'Judges on this challenge' : 'Master roster'}
          <span className="ml-2 text-sm font-normal text-muted-foreground">{judges.length}</span>
        </h3>
        {loading ? (
          <p className="mt-4 text-sm text-muted-foreground">Loading the roster…</p>
        ) : (
          <JudgeRosterTable
            judges={judges}
            onEdit={(j) => { setFormJudge(j); setFormOpen(true); }}
            onView={(j) => setDetailId(j.id)}
          />
        )}
      </section>

      <JudgeAssignmentsPanel challenges={challenges} judges={judges} actingEmail={actingEmail} />

      {detailId && (
        <JudgeDetailDialog
          key={detailId}
          open={!!detailId}
          onOpenChange={(v) => !v && setDetailId('')}
          judgeId={detailId}
          onEdit={(j) => { setDetailId(''); setFormJudge(j); setFormOpen(true); }}
        />
      )}

      {formOpen && (
        <JudgeFormDialog
          key={formJudge?.id || 'new'}
          open={formOpen}
          onOpenChange={setFormOpen}
          judge={formJudge}
          onSaved={load}
        />
      )}
    </>
  );
}