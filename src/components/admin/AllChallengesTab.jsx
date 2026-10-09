import { useCallback, useEffect, useState } from 'react';
import SectionToolbar from '@/components/admin/SectionToolbar';
import ChallengeFormDialog from '@/components/admin/ChallengeFormDialog';
import ChallengeFilterBar from '@/components/admin/challenges/ChallengeFilterBar';
import ChallengeTable from '@/components/admin/challenges/ChallengeTable';
import { adminChallengeApi } from '@/lib/adminChallengeApi';

const EMPTY = { status: '', stage: '', season: '', sort: '-created_date' };

export default function AllChallengesTab({ categories, reference, onReload, openCreate, onCreateHandled }) {
  const [rows, setRows] = useState([]);
  const [filters, setFilters] = useState(EMPTY);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await adminChallengeApi.listChallenges({
        sort: filters.sort,
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.stage ? { stage: filters.stage } : {}),
        ...(filters.season ? { season: filters.season } : {}),
        ...(query ? { search: query } : {}),
      });
      setRows(data.challenges || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [filters, query]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!openCreate) return;
    setEditing(null);
    setOpen(true);
    onCreateHandled?.();
  }, [openCreate]);

  const saved = () => { load(); onReload?.(); };
  // Flip the featured flag in place and tell the parent. Optimistic, so the
  // star answers at once; if the update is refused the row goes back and the
  // reason is shown, rather than the star lying about what is on record.
  const toggleFeatured = async (c) => {
    const next = !c.is_featured;
    setRows((prev) => prev.map((r) => (r.id === c.id ? { ...r, is_featured: next } : r)));
    try {
      const res = await adminChallengeApi.updateChallenge({ id: c.id, challenge: { is_featured: next } });
      if (res?.ok === false) throw new Error(res?.error?.message || res?.error || 'Update refused');
      onReload?.();
    } catch (e) {
      setRows((prev) => prev.map((r) => (r.id === c.id ? { ...r, is_featured: !next } : r)));
      setError((e && e.message) || 'Could not update the featured flag.');
    }
  };

  return (
    <>
      <SectionToolbar
        section="challenges"
        title="All challenges"
        description="Every challenge in the parent platform with its season, stage, status, entry counts and judging weights."
      />

      <ChallengeFilterBar
        filters={filters}
        reference={reference}
        search={search}
        onSearch={setSearch}
        onChange={(k, v) => setFilters((p) => ({ ...p, [k]: v }))}
        onSubmitSearch={() => setQuery(search.trim())}
      />

      {error && <p className="mt-4 text-sm text-destructive">{error}</p>}

      {loading ? (
        <p className="mt-6 text-sm text-muted-foreground">Loading challenges…</p>
      ) : (
        <ChallengeTable challenges={rows} onEdit={(c) => { setEditing(c); setOpen(true); }} onToggleFeatured={toggleFeatured} />
      )}

      {open && (
        <ChallengeFormDialog
          key={editing?.id || 'new'}
          open={open}
          onOpenChange={setOpen}
          challenge={editing}
          categories={categories}
          reference={reference}
          onSaved={saved}
        />
      )}
    </>
  );
}