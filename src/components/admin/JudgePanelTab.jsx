import { useCallback, useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import SectionToolbar from '@/components/admin/SectionToolbar';
import PanelQuorumBar from '@/components/admin/judgePanel/PanelQuorumBar';
import PanelMembersTable from '@/components/admin/judgePanel/PanelMembersTable';
import PanelRecusalsPanel from '@/components/admin/judgePanel/PanelRecusalsPanel';
import InviteJudgePanel from '@/components/admin/judgePanel/InviteJudgePanel';
import AddJudgeDialog from '@/components/admin/judgePanel/AddJudgeDialog';
import RemoveMemberDialog from '@/components/admin/judgePanel/RemoveMemberDialog';
import PanelMemberDialog from '@/components/admin/judgePanel/PanelMemberDialog';
import { adminChallengeApi } from '@/lib/adminChallengeApi';

export default function JudgePanelTab({ challengeId, actingEmail }) {
  const [data, setData] = useState(null);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [viewMember, setViewMember] = useState(null);
  const [removeMember, setRemoveMember] = useState(null);
  const [addOpen, setAddOpen] = useState(false);

  const load = useCallback(async () => {
    if (!challengeId) { setData(null); setLoading(false); return; }
    setLoading(true);
    setError('');
    try {
      setData(await adminChallengeApi.judgePanel({ challengeId, ...(query ? { search: query } : {}) }));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [challengeId, query]);

  useEffect(() => { load(); }, [load]);

  if (!challengeId) {
    return (
      <>
        <SectionToolbar section="judges" title="Judge panel" description="Choose a challenge to see its panel." />
        <p className="mt-4 text-sm text-muted-foreground">Pick a challenge above to load its judging panel.</p>
      </>
    );
  }

  const members = data?.members || [];

  return (
    <>
      <SectionToolbar
        section="judges"
        challengeId={challengeId}
        title="Judge panel"
        description="Who is judging this challenge, whether the panel is full, any conflicts declared, and who else you can invite."
      />

      <form className="mt-4 flex items-center gap-2" onSubmit={(e) => { e.preventDefault(); setQuery(search.trim()); }}>
        <label htmlFor="jp-search" className="sr-only">Search panel members</label>
        <input
          id="jp-search"
          className="c53-input w-60"
          placeholder="Search name or email"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button type="submit" className="rounded-lg bg-muted p-2.5 text-muted-foreground hover:text-foreground" aria-label="Search">
          <Search className="h-4 w-4" />
        </button>
      </form>

      {error && <p className="mt-4 text-sm text-destructive">{error}</p>}

      {loading ? (
        <p className="mt-5 text-sm text-muted-foreground">Loading the panel…</p>
      ) : data ? (
        <>
          <PanelQuorumBar challenge={data.challenge} quorum={data.quorum} recusalsCount={data.recusals_count} />

          <section className="mt-5 rounded-2xl border border-border bg-card/60 p-5">
            <h3 className="font-heading text-base font-bold">
              Panel members
              <span className="ml-2 text-sm font-normal text-muted-foreground">{data.count ?? members.length}</span>
            </h3>
            <PanelMembersTable members={members} onOpen={setViewMember} onRemove={setRemoveMember} />
          </section>

          <PanelRecusalsPanel recusals={data.recusals} challengeRecusals={data.challenge_recusals} />

          <InviteJudgePanel
            challengeId={challengeId}
            judges={data.assignable_judges}
            actingEmail={actingEmail}
            onInvited={load}
            onAddNew={() => setAddOpen(true)}
          />
        </>
      ) : null}

      {viewMember && (
        <PanelMemberDialog
          key={viewMember.id}
          open={!!viewMember}
          onOpenChange={(v) => !v && setViewMember(null)}
          challengeId={challengeId}
          member={viewMember}
        />
      )}

      {removeMember && (
        <RemoveMemberDialog
          key={removeMember.id}
          open={!!removeMember}
          onOpenChange={(v) => !v && setRemoveMember(null)}
          challengeId={challengeId}
          member={removeMember}
          actingEmail={actingEmail}
          onRemoved={async () => { setRemoveMember(null); await load(); }}
        />
      )}

      {addOpen && (
        <AddJudgeDialog
          open={addOpen}
          onOpenChange={setAddOpen}
          challengeId={challengeId}
          challengeCategory={data?.challenge?.category}
          actingEmail={actingEmail}
          onAdded={async () => { setAddOpen(false); await load(); }}
        />
      )}
    </>
  );
}