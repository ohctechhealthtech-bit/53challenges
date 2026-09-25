import { useCallback, useEffect, useState } from 'react';
import SectionToolbar from '@/components/admin/SectionToolbar';
import RequestsHub from '@/components/admin/hostRequests/RequestsHub';
import { adminChallengeApi } from '@/lib/adminChallengeApi';
import { base44 } from '@/api/base44Client';
import { mapLocalDraft } from '@/components/admin/hostRequests/mapLocalDraft';

export default function HostRequestsTab({ onCounts }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const [reqData, localDrafts] = await Promise.all([
        adminChallengeApi.listHostRequests({}),
        base44.entities.ChallengeDraft.filter({ origin: 'host_apply' }, '-created_date', 200).catch(() => []),
      ]);
      const parentReqs = reqData.requests || [];
      // Build a lookup of parent contact_email + working_title (case-insensitive)
      // so we can skip local drafts that the parent already has.
      const parentKeys = new Set(
        parentReqs.map((r) =>
          `${(r.contact_email || '').toLowerCase()}||${(r.working_title || r.challenge_title || '').toLowerCase()}`
        )
      );
      // Local drafts are a FALLBACK only for applications that never reached
      // the parent. Skip a draft if it has a main-app id (it was accepted), or
      // if a parent row matches on contact_email + working_title.
      const localMapped = (localDrafts || [])
        .map(mapLocalDraft)
        .filter((d) => {
          if (!d) return false;
          if (d._main_app_proposal_id) return false;
          const key = `${(d.contact_email || '').toLowerCase()}||${(d.working_title || '').toLowerCase()}`;
          if (parentKeys.has(key)) return false;
          return true;
        })
        .map((d) => ({ ...d, not_synced: true }));
      const all = [...parentReqs, ...localMapped].sort(
        (a, b) => new Date(b.submitted_at || b.created_date || 0) - new Date(a.submitted_at || a.created_date || 0)
      );
      setRequests(all);
      onCounts?.(all.filter((r) => !r.is_read).length);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [onCounts]);

  useEffect(() => { load(); }, [load]);

  return (
    <>
      <SectionToolbar
        section="requests"
        title="Host requests"
        description="Enquiries from companies and individuals who want us to run a challenge. Review, chat, quote, then convert an accepted one into a real challenge."
      />

      {error && <p className="mt-4 text-sm text-destructive">{error}</p>}

      {loading ? (
        <p className="mt-6 text-sm text-muted-foreground">Loading host requests…</p>
      ) : (
        <RequestsHub
          hostRequests={requests}
          onChanged={load}
        />
      )}
    </>
  );
}