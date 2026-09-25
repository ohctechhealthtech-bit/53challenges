import { useEffect, useMemo, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Heart, Vote as VoteIcon, Users, AlertTriangle } from 'lucide-react';
import { challengeApi } from '@/lib/challengeApi';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import DiscoverToolbar from '@/components/challenges/discover/DiscoverToolbar';
import VoteCard from '@/components/challenges/discover/VoteCard';
import EntryLightbox from '@/components/challenges/discover/EntryLightbox';
import { categoryMeta, challengePhase, daysLeft } from '@/lib/challenges-data';
import { getPanelForCompetition, getCombinedResults } from '@/lib/votes';
import { getAuditReview, getJudges } from '@/lib/audit';
import { getPathwayForChallenge, getSeriesStandings, getPromotionsTo, getPromotedEntries } from '@/lib/pathways';
import PathwayBadge from '@/components/pathways/PathwayBadge';
import PathwayStandings from '@/components/pathways/PathwayStandings';
import ShareToEarn from '@/components/challenges/ShareToEarn';
import { Trophy as TrophyIcon, BadgeCheck, Users as UsersIcon, ScrollText } from 'lucide-react';

export default function ChallengeFinalists() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const [challenge, setChallenge] = useState(null);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [division, setDivision] = useState('');
  const [state, setState] = useState('');
  const [sort, setSort] = useState('-community_votes');
  const [lightbox, setLightbox] = useState(null);
  const [votedIds, setVotedIds] = useState(() => new Set());
  const [voteCounts, setVoteCounts] = useState({});
  const [panel, setPanel] = useState(null);
  const [combined, setCombined] = useState({ rows: [], map: {} });
  const [auditReview, setAuditReview] = useState(null);
  const [judges, setJudges] = useState([]);
  const [pathwayInfo, setPathwayInfo] = useState(null);
  const [seriesStandings, setSeriesStandings] = useState([]);
  const [commentCounts, setCommentCounts] = useState({});

  // Comment counts for every entry in this challenge, in one query.
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    base44.entities.EntryComment.filter({ challenge_id: id }, '-created_date', 1000)
      .then((rows) => {
        if (cancelled) return;
        const counts = {};
        for (const c of rows || []) counts[c.entry_id] = (counts[c.entry_id] || 0) + 1;
        setCommentCounts(counts);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [id]);

  useEffect(() => {
    (async () => {
      setLoading(true); setError('');
      try {
        const [ch, ents] = await Promise.all([
          challengeApi.getChallenge(id),
          challengeApi.listEntries(id, { sort: '-community_votes', limit: 500 }),
        ]);
        setChallenge(ch);
        let merged = ents || [];
        // Resolve pathway + merge promoted entries if this is a national final.
        const pInfo = await getPathwayForChallenge(id).catch(() => null);
        setPathwayInfo(pInfo);
        if (pInfo?.pathway?.type === 'series_championship') {
          setSeriesStandings(await getSeriesStandings(pInfo.pathway.id).catch(() => []));
        } else { setSeriesStandings([]); }
        if (pInfo?.isAnchor && (pInfo.pathway?.type === 'state_to_national' || pInfo.pathway?.type === 'local_to_state_to_national')) {
          const [promos, local] = await Promise.all([getPromotionsTo(id), getPromotedEntries(id)]);
          const srcIds = new Set((promos || []).map((p) => p.source_entry_id));
          const promoted = (local || [])
            .filter((e) => e.upstream_entry_id && srcIds.has(e.upstream_entry_id))
            .map((e) => ({ ...e, community_votes: e.vote_count || 0 }));
          merged = [...merged, ...promoted];
        }
        setEntries(merged);
      } catch (e) {
        setError(e?.message || 'Could not load finalists.');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  // Fetch per-entry vote counts + which entries the current user has voted,
  // so the UI shows accurate counts and the "Voted" state.
  useEffect(() => {
    if (!challenge?.id) return;
    (async () => {
      try {
        const res = await challengeApi.getChallengeVotes(challenge.id, isAuthenticated ? user?.email : null);
        setVotedIds(new Set(res.votedEntryIds || []));
        setVoteCounts(res.counts || {});
      } catch {
        // non-fatal — counts fall back to upstream entry data
      }
    })();
  }, [challenge?.id, isAuthenticated, user?.email]);

  // Public weighting + locked combined results for this competition.
  useEffect(() => {
    if (!challenge?.id) return;
    (async () => {
      const p = await getPanelForCompetition(challenge.id);
      setPanel(p);
      if (p?.results_locked) {
        const cr = await getCombinedResults(challenge.id);
        setCombined(cr);
        const [ar, js] = await Promise.all([
          getAuditReview(challenge.id), getJudges(challenge.id),
        ]);
        setAuditReview(ar);
        setJudges(js || []);
      } else {
        setCombined({ rows: [], map: {} });
        setAuditReview(null); setJudges([]);
      }
    })();
  }, [challenge?.id]);

  const onVoted = (entryId, newCount) => {
    setVotedIds((prev) => new Set(prev).add(entryId));
    setVoteCounts((prev) => ({ ...prev, [entryId]: newCount }));
    // After voting in this challenge, take the voter back to the challenge
    // list so they can pick the next challenge to vote in.
    setLightbox(null);
    setTimeout(() => navigate('/challenges'), 1800);
  };

  const presentStates = useMemo(() => [...new Set(entries.map((e) => e.state).filter(Boolean))], [entries]);

  const filtered = useMemo(() => {
    return entries.filter((e) => {
      if (division && e.division !== division) return false;
      if (state && e.state !== state) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!(`${e.title} ${e.creator_name}`.toLowerCase().includes(q))) return false;
      }
      return true;
    });
  }, [entries, division, state, search]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    const countFor = (e) => voteCounts[e.id] ?? e.community_votes ?? e.vote_count ?? 0;
    if (sort === '-submitted_at') {
      arr.sort((a, b) => new Date(b.submitted_at || 0) - new Date(a.submitted_at || 0));
    } else {
      arr.sort((a, b) => countFor(b) - countFor(a));
    }
    return arr;
  }, [filtered, sort, voteCounts]);

  // Group sorted entries by participant (creator) so the lightbox can scroll
  // content within a participant (right/left) and between participants (up/down).
  const participants = useMemo(() => {
    const groups = [];
    const byKey = {};
    for (const e of sorted) {
      const key = e.creator_name || e.user_name || 'Unknown';
      if (!byKey[key]) { byKey[key] = { name: key, items: [] }; groups.push(byKey[key]); }
      byKey[key].items.push(e);
    }
    return groups;
  }, [sorted]);

  // Map each entry id -> { p, c } position in the participants array.
  const entryPos = useMemo(() => {
    const m = {};
    participants.forEach((part, pi) => part.items.forEach((e, ci) => { m[e.id] = { p: pi, c: ci }; }));
    return m;
  }, [participants]);

  const openLightbox = (flatIndex) => {
    const e = sorted[flatIndex];
    if (!e) return;
    const pos = entryPos[e.id];
    if (pos) setLightbox(pos);
  };

  const reset = () => { setSearch(''); setDivision(''); setState(''); setSort('-community_votes'); };

  if (loading) return <div className="container-tight py-24 text-center text-muted-foreground">Loading finalists…</div>;
  if (error) return <div className="container-tight py-24 text-center text-destructive">{error}</div>;
  if (!challenge) return (
    <div className="container-tight py-24 text-center">
      <p className="text-muted-foreground">Challenge not found.</p>
      <Link to="/challenges" className="mt-4 inline-block text-primary hover:underline">← Back to challenges</Link>
    </div>
  );

  const cat = categoryMeta(challenge.category);
  const phase = challengePhase(challenge);
  const deadline = phase === 'vote' ? challenge.voting_ends_at : challenge.submission_ends_at;
  const finished = phase === 'closed';
  const complianceBlocked = !!challenge.compliance_blocked;

  return (
    <div>
      {/* Simple header */}
      <div className="border-b border-border">
        <div className="container-tight py-8">
          <Link to="/challenges" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> All challenges
          </Link>
          <h1 className="font-heading text-3xl font-extrabold sm:text-4xl">{challenge.theme || challenge.title}</h1>
          {complianceBlocked && (
            <div className="mt-5 inline-flex items-center gap-2 rounded-xl bg-amber-500/15 px-5 py-3 text-sm font-semibold text-amber-300 ring-1 ring-amber-400/40">
              <AlertTriangle className="h-4 w-4" /> Entries &amp; voting paused pending compliance review
            </div>
          )}
        </div>
      </div>

      <ShareToEarn challengeId={challenge.id} title={challenge.theme || challenge.title} />

      {/* Public weighting + combined results */}
      {panel && panel.weighting_visible && (
        <div className="container-tight pt-6">
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-heading text-sm font-bold">Combined scoring weighting</h3>
                <p className="text-xs text-muted-foreground">Final result combines the judging panel with the public vote.</p>
              </div>
              <div className="flex items-center gap-2 text-sm font-semibold">
                <span className="rounded-lg bg-primary/15 px-3 py-1 text-primary">{Math.round((panel.judge_weight ?? 0.7) * 100)}% Judging</span>
                <span className="text-muted-foreground">+</span>
                <span className="rounded-lg bg-pink-500/15 px-3 py-1 text-pink-300">{Math.round((panel.public_weight ?? 0.3) * 100)}% Public Vote</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {pathwayInfo?.pathway && (pathwayInfo.pathway.type === 'national_state_ranking' || pathwayInfo.pathway.type === 'series_championship') && (
        <div className="container-tight py-6">
          <h2 className="mb-3 flex items-center gap-2 font-heading text-xl font-bold">
            {pathwayInfo.pathway.type === 'series_championship' ? <TrophyIcon className="h-5 w-5 text-amber-400" /> : <UsersIcon className="h-5 w-5 text-primary" />}
            {pathwayInfo.pathway.type === 'series_championship' ? 'Series standings' : 'National & state rankings'}
          </h2>
          <PathwayStandings pathway={pathwayInfo.pathway} entries={entries} standings={seriesStandings} />
        </div>
      )}

      {panel?.results_locked && (
        <div className="container-tight py-6">
          {/* Pending audit gate: winners can't be announced / prizes released until signed off */}
          {auditReview?.status !== 'signed_off' ? (
            <div className="flex items-start gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/5 p-5">
              <ScrollText className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
              <div>
                <h2 className="font-heading text-lg font-bold text-amber-300">Results pending independent audit</h2>
                <p className="mt-1 text-sm text-muted-foreground">Final placings are verified but not yet announced. Winners and prize payouts are held until the audit sign-off is complete.</p>
              </div>
            </div>
          ) : (
            <>
              {/* Independently audited badge + judge credits + method */}
              <div className="mb-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-5">
                <div className="flex flex-wrap items-center gap-3">
                  <BadgeCheck className="h-5 w-5 text-emerald-400" />
                  <span className="font-heading text-lg font-bold text-emerald-300">Independently audited</span>
                  <span className="text-xs text-muted-foreground">Signed off{auditReview?.sign_off_at ? ` ${new Date(auditReview.sign_off_at).toLocaleDateString()}` : ''} by {auditReview?.sign_off_name}</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
                  <span><b className="text-foreground">Judging method:</b> Blind judging — {Math.round((panel?.judge_weight ?? 0.7) * 100)}% judging / {Math.round((panel?.public_weight ?? 0.3) * 100)}% public vote</span>
                  {panel?.criteria?.length > 0 && <span><b className="text-foreground">Criteria:</b> {panel.criteria.map((c) => c.name).join(' · ')}</span>}
                </div>
                {judges.length > 0 && (
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <UsersIcon className="h-3.5 w-3.5" />
                    <b className="text-foreground">Judge credits:</b>
                    {judges.map((j) => (
                      <span key={j.id} className="rounded-full bg-white/5 px-2.5 py-0.5 text-xs font-semibold">{j.name}</span>
                    ))}
                  </div>
                )}
                {auditReview?.routed_to && (
                  <p className="mt-2 text-xs text-orange-400">Routing for resolution: {auditReview.routed_to} · re-audit #{auditReview.re_audit_count}</p>
                )}
              </div>

              {combined.rows.length > 0 && (
                <>
                  <h2 className="mb-3 flex items-center gap-2 font-heading text-xl font-bold"><TrophyIcon className="h-5 w-5 text-amber-400" /> Final results</h2>
                  <div className="overflow-hidden rounded-2xl border border-border bg-card">
                    <ol className="divide-y divide-border">
                      {combined.rows.map((r) => {
                        const e = entries.find((en) => en.id === r.entry_id);
                        return (
                          <li key={r.entry_id} className="flex items-center justify-between gap-3 px-4 py-3">
                            <div className="flex items-center gap-3 min-w-0">
                              <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-extrabold ${r.combined_rank <= 3 ? 'grad-bg text-white' : 'bg-muted text-muted-foreground'}`}>{r.combined_rank}</span>
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold">{e?.title || r.entry_title || `Entry ${r.entry_id}`}</p>
                                <p className="text-xs text-muted-foreground">{e?.creator_name || r.creator_name || ''}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                              <span>Judge <b className="text-foreground">{r.judge_score.toFixed(1)}</b></span>
                              <span>Public <b className="text-foreground">{r.public_score.toFixed(1)}</b> <span className="opacity-60">({r.public_votes}v)</span></span>
                              <span className="font-heading text-lg font-extrabold text-primary">{r.combined_score.toFixed(2)}</span>
                            </div>
                          </li>
                        );
                      })}
                    </ol>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      )}

      {/* Search / filter / sort toolbar */}
      <DiscoverToolbar
        search={search} setSearch={setSearch}
        division={division} setDivision={setDivision}
        state={state} setState={setState}
        sort={sort} setSort={setSort}
        states={presentStates}
        onReset={reset}
      />

      {/* Finalists scroller */}
      <div className="container-tight py-10">
        <div className="mb-5">
          <h2 className="font-heading text-xl font-bold">
            {sorted.length} finalist{sorted.length === 1 ? '' : 's'}
            {sorted.length !== entries.length && <span className="ml-2 text-sm font-normal text-muted-foreground">of {entries.length}</span>}
          </h2>
        </div>

        {sorted.length ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 items-start">
            {sorted.map((e, i) => (
              <VoteCard
                key={e.id}
                entry={e}
                rank={i + 1}
                index={i}
                finished={finished}
                complianceBlocked={complianceBlocked}
                challengeTheme={challenge.theme || challenge.title}
                onOpen={openLightbox}
                votedEntryIds={votedIds}
                onVoted={onVoted}
                initialCount={voteCounts[e.id] ?? e.community_votes ?? e.vote_count ?? 0}
                commentCount={commentCounts[e.id] || 0}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-3xl border border-dashed border-border py-20 text-center">
            <div className="text-5xl">{entries.length ? '🔍' : '🗳️'}</div>
            <p className="mt-4 font-heading text-xl font-bold">{entries.length ? 'No finalists match your filters' : 'No finalists yet'}</p>
            <p className="mt-1 text-muted-foreground">{entries.length ? 'Try clearing your filters.' : 'Approved entries will appear here for community voting.'}</p>
            {(search || division || state) && (
              <button onClick={reset} className="mt-6 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground">Clear filters</button>
            )}
          </div>
        )}
      </div>
      {lightbox && participants[lightbox.p] && (
        <EntryLightbox
          participants={participants}
          p={lightbox.p}
          c={Math.min(lightbox.c, (participants[lightbox.p].items.length - 1))}
          finished={finished}
          votedEntryIds={votedIds}
          voteCounts={voteCounts}
          onVoted={onVoted}
          onClose={() => setLightbox(null)}
          onNavigate={(np, nc) => setLightbox({ p: np, c: nc })}
        />
      )}
    </div>
  );
}