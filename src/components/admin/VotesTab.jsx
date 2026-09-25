import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import SectionToolbar from '@/components/admin/SectionToolbar';
import VotesSummary from '@/components/admin/votes/VotesSummary';
import VoteTable from '@/components/admin/votes/VoteTable';
import { VOTE_VIEWS } from '@/components/admin/votes/votesMeta';
import { adminChallengeApi } from '@/lib/adminChallengeApi';

export default function VotesTab({ challengeId }) {
  const [view, setView] = useState('all');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');

  const load = useCallback(async () => {
    if (!challengeId) { setData(null); setLoading(false); return; }
    setLoading(true);
    setError('');
    try {
      setData(await adminChallengeApi.votes({ challengeId, view }));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [challengeId, view]);

  useEffect(() => { load(); }, [load]);

  const recalc = async () => {
    setBusy(true);
    setError('');
    setNote('');
    try {
      const res = await adminChallengeApi.recalcVoteTotals({ challengeId });
      setNote(`${res.entries_updated ?? 0} of ${res.entries_checked ?? 0} entries corrected.`);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const onChanged = async (res) => {
    if (res?.entry_community_votes != null) setNote(`That entry now counts ${res.entry_community_votes} votes.`);
    await load();
  };

  if (!challengeId) {
    return (
      <>
        <SectionToolbar section="votes" title="Votes & integrity" description="Choose a challenge to review its public votes." />
        <p className="mt-4 text-sm text-muted-foreground">Pick a challenge above to load its votes.</p>
      </>
    );
  }

  return (
    <>
      <SectionToolbar
        section="votes"
        title="Votes & integrity"
        description="Every public vote with the checks that flagged it, so you can count the genuine ones and block the rest."
        challengeId={challengeId}
      />

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {VOTE_VIEWS.map((v) => (
          <button
            key={v.key}
            onClick={() => setView(v.key)}
            className={`rounded-full px-3 py-1.5 text-sm font-semibold ${view === v.key ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
          >
            {v.label}
            {v.key === 'suspicious' && data?.counts?.suspicious ? ` (${data.counts.suspicious})` : ''}
          </button>
        ))}
        <Button variant="outline" className="ml-auto" onClick={recalc} disabled={busy || loading}>
          {busy ? 'Recounting…' : 'Recount every entry'}
        </Button>
      </div>

      {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
      {note && <p className="mt-3 text-sm text-success">{note}</p>}

      <VotesSummary data={data} />

      {loading ? (
        <p className="mt-4 text-sm text-muted-foreground">Loading votes…</p>
      ) : (
        <VoteTable votes={data?.votes || []} challengeId={challengeId} onChanged={onChanged} />
      )}
    </>
  );
}