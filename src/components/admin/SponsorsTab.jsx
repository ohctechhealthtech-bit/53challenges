import { useCallback, useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import SectionToolbar from '@/components/admin/SectionToolbar';
import SponsorSummary from '@/components/admin/sponsors/SponsorSummary';
import SponsorFilterBar from '@/components/admin/sponsors/SponsorFilterBar';
import SponsorTable from '@/components/admin/sponsors/SponsorTable';
import SponsorFormDialog from '@/components/admin/sponsors/SponsorFormDialog';
import DeleteSponsorDialog from '@/components/admin/sponsors/DeleteSponsorDialog';
import EnquiriesPanel from '@/components/admin/sponsors/EnquiriesPanel';
import EnquiryDialog from '@/components/admin/sponsors/EnquiryDialog';
import { TIERS, APPLICATION_STATUSES } from '@/components/admin/sponsors/sponsorsMeta';
import { adminChallengeApi } from '@/lib/adminChallengeApi';

export default function SponsorsTab({ challengeId, actingEmail }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({ tier: '', active: '', season: '', search: '', applicationStatus: '' });
  const [searchInput, setSearchInput] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [enquiry, setEnquiry] = useState(null);
  const [busyId, setBusyId] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = { actingEmail };
      Object.entries(filters).forEach(([k, v]) => { if (v) params[k] = v; });
      setData(await adminChallengeApi.listSponsors(params));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [filters, actingEmail]);

  useEffect(() => { load(); }, [load]);

  const setFilter = (key, value) => setFilters((p) => ({ ...p, [key]: value }));

  const toggleVisible = async (sponsor) => {
    setBusyId(sponsor.id);
    setError('');
    try {
      await adminChallengeApi.updateSponsor({ id: sponsor.id, sponsor: { is_active: sponsor.is_active === false }, actingEmail });
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId('');
    }
  };

  const tiers = data?.tiers || TIERS;

  return (
    <>
      <SectionToolbar
        section="sponsors"
        title="Sponsors"
        description="Who backs the challenges, what they show on the pages, and new enquiries."
        challengeId={challengeId}
      />

      {data?.note && (
        <p className="mt-4 rounded-xl border border-border bg-card/60 px-4 py-3 text-sm text-muted-foreground">{data.note}</p>
      )}
      {error && <p className="mt-4 text-sm text-destructive">{error}</p>}

      {data && (
        <SponsorSummary
          counts={data.counts || {}}
          unread={data.application_counts?.unread ?? 0}
          prospects={data.prospect_count ?? 0}
        />
      )}

      <SponsorFilterBar
        filters={filters}
        tiers={tiers}
        onChange={setFilter}
        searchInput={searchInput}
        onSearchInput={setSearchInput}
        onSearch={() => setFilter('search', searchInput.trim())}
      />

      <div className="mt-5 flex items-center justify-between gap-3">
        <h3 className="font-heading text-base font-bold">
          Sponsors
          <span className="ml-2 text-sm font-normal text-muted-foreground">{data?.count ?? 0}</span>
        </h3>
        <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
          <Plus className="h-4 w-4" /> Add sponsor
        </Button>
      </div>

      {loading && !data ? (
        <p className="mt-4 text-sm text-muted-foreground">Loading sponsors…</p>
      ) : (
        <SponsorTable
          sponsors={data?.sponsors || []}
          busyId={busyId}
          onEdit={(s) => { setEditing(s); setFormOpen(true); }}
          onToggle={toggleVisible}
          onDelete={setDeleting}
        />
      )}

      <EnquiriesPanel
        applications={data?.applications || []}
        counts={data?.application_counts || {}}
        statuses={data?.application_statuses || APPLICATION_STATUSES}
        filter={filters.applicationStatus}
        onFilter={(s) => setFilter('applicationStatus', s)}
        onOpen={setEnquiry}
      />

      <SponsorFormDialog
        open={formOpen}
        sponsor={editing}
        tiers={tiers}
        adTypes={data?.ad_asset_types}
        actingEmail={actingEmail}
        onClose={() => setFormOpen(false)}
        onSaved={async () => { setFormOpen(false); await load(); }}
      />

      {deleting && (
        <DeleteSponsorDialog
          sponsor={deleting}
          actingEmail={actingEmail}
          onClose={() => setDeleting(null)}
          onDeleted={async () => { setDeleting(null); await load(); }}
        />
      )}

      {enquiry && (
        <EnquiryDialog
          enquiry={enquiry}
          tiers={tiers}
          actingEmail={actingEmail}
          onClose={() => setEnquiry(null)}
          onChanged={async () => { setEnquiry(null); await load(); }}
        />
      )}
    </>
  );
}