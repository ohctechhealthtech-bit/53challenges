import { useCallback, useEffect, useState } from 'react';
import SectionToolbar from '@/components/admin/SectionToolbar';
import AddExclusionForm from '@/components/admin/exclusions/AddExclusionForm';
import ExclusionsTable from '@/components/admin/exclusions/ExclusionsTable';
import { adminChallengeApi } from '@/lib/adminChallengeApi';

export default function ExclusionsTab({ actingEmail }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(await adminChallengeApi.exclusions());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <>
      <SectionToolbar
        section="exclusions"
        title="Exclusions"
        description="People who cannot enter or vote. This list applies across the whole season."
      />

      {data?.note && (
        <p className="mt-4 rounded-xl border border-border bg-card/60 px-4 py-3 text-sm text-muted-foreground">
          {data.note}
        </p>
      )}

      <AddExclusionForm
        reasons={data?.reasons}
        actingEmail={actingEmail}
        onAdded={async () => { setNote('Added to the exclusion list.'); await load(); }}
      />

      {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
      {note && <p className="mt-3 text-sm text-success">{note}</p>}

      <section className="mt-5">
        <h3 className="font-heading text-base font-bold">
          On the list
          <span className="ml-2 text-sm font-normal text-muted-foreground">
            {data?.count ?? 0} · showing the 200 most recent
          </span>
        </h3>
        {loading ? (
          <p className="mt-4 text-sm text-muted-foreground">Loading the list…</p>
        ) : (
          <ExclusionsTable
            exclusions={data?.exclusions || []}
            onRemoved={async (row) => { setNote(`${row.email} can enter and vote again.`); await load(); }}
          />
        )}
      </section>
    </>
  );
}