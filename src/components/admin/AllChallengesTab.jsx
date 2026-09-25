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
        <ChallengeTable challenges={rows} onEdit={(c) => { setEditing(c); setOpen(true); }} />
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