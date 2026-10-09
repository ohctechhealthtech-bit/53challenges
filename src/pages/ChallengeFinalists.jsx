import { useEffect, useMemo, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, AlertTriangle } from 'lucide-react';
import { challengeApi } from '@/lib/challengeApi';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import DiscoverToolbar from '@/components/challenges/discover/DiscoverToolbar';
import VoteCard from '@/components/challenges/discover/VoteCard';
import VoteCardSkeleton from '@/components/challenges/discover/VoteCardSkeleton';
import EntryLightbox from '@/components/challenges/discover/EntryLightbox';
import { challengePhase } from '@/lib/challenges-data';
import { getPanelForCompetition, getCombinedResults } from '@/lib/votes';
import { getAuditReview, getJudges } from '@/lib/audit';
import { getPathwayForChallenge, getSeriesStandings, getPromotionsTo, getPromotedEntries } from '@/lib/pathways';
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

  const canvas = 'min-h-screen bg-[#FDF8F1] text-stone-900';
  const title = challenge ? (challenge.theme || challenge.title) : '';

  // The main site's Discover & Vote layout: a cream canvas, a centred header,
  // a sticky toolbar and one column of cards. Loading shows the page's own
  // shape with card skeletons rather than a line of text.
  if (loading) return (
    <div className={canvas}>
      <div className="px-4 pb-6 pt-10 text-center sm:px-8">
        <h1 className="text-3xl font-extrabold tracking-tight text-stone-900 sm:text-4xl">Discover <span className="text-orange-500">&amp;</span> Vote</h1>
        <p className="mt-2 text-base text-stone-600 sm:text-lg">Browse creators and support your favorites</p>
      </div>
      <div className="mx-auto w-full max-w-3xl space-y-4 px-4 py-6 pb-16 sm:px-8">
        <VoteCardSkeleton />
        <VoteCardSkeleton />
        <VoteCardSkeleton />
      </div>
    </div>
  );
  if (error) return (
    <div className={canvas}><div className="px-4 py-24 text-center text-red-600">{error}</div></div>
  );
  if (!challenge) return (
    <div className={canvas}>
      <div className="px-4 py-24 text-center">
        <p className="text-stone-600">Challenge not found.</p>
        <Link to="/challenges" className="mt-4 inline-block text-teal-700 hover:underline">&larr; Back to challenges</Link>
      </div>
    </div>
  );

  const phase = challengePhase(challenge);
  const finished = phase === 'closed';
  const complianceBlocked = !!challenge.compliance_blocked;
  const byTitle = (a, b) => String(a.title || '').localeCompare(String(b.title || ''));
  const list = sort === 'alphabetical' ? [...filtered].sort(byTitle) : sorted;
  const hasFilters = !!search.trim() || !!division || !!state;

  return (
    <div className={canvas}>
      <div className="px-4 pb-6 pt-10 text-center sm:px-8">
        <Link to="/challenges" className="mb-4 inline-flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-900">
          <ArrowLeft className="h-4 w-4" /> All challenges
        </Link>
        <h1 className="text-3xl font-extrabold tracking-tight text-stone-900 sm:text-4xl">Discover <span className="text-orange-500">&amp;</span> Vote</h1>
        <p className="mt-2 text-base text-stone-600 sm:text-lg">Browse creators and support your favorites</p>
        <h2 className="mt-5 font-heading text-xl font-bold text-stone-800 sm:text-2xl">{title}</h2>
        {complianceBlocked && (
          <div className="mt-5 inline-flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-5 py-3 text-sm font-semibold text-amber-800">
            <AlertTriangle className="h-4 w-4" /> Entries &amp; voting paused pending compliance review
          </div>
        )}
      </div>

      <ShareToEarn challengeId={challenge.id} title={title} />

      {panel && panel.weighting_visible && (
        <div className="mx-auto w-full max-w-3xl px-4 pt-6 sm:px-8">
          <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-heading text-sm font-bold text-stone-900">Combined scoring weighting</h3>
                <p className="text-xs text-stone-500">Final result combines the judging panel with the public vote.</p>
              </div>
              <div className="flex items-center gap-2 text-sm font-semibold">
                <span className="rounded-lg bg-teal-50 px-3 py-1 text-teal-800">{Math.round((panel.judge_weight ?? 0.7) * 100)}% Judging</span>
                <span className="text-stone-400">+</span>
                <span className="rounded-lg bg-orange-50 px-3 py-1 text-orange-800">{Math.round((panel.public_weight ?? 0.3) * 100)}% Public Vote</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {pathwayInfo?.pathway && (pathwayInfo.pathway.type === 'national_state_ranking' || pathwayInfo.pathway.type === 'series_championship') && (
        <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-8">
          <h2 className="mb-3 flex items-center gap-2 font-heading text-xl font-bold text-stone-900">
            {pathwayInfo.pathway.type === 'series_championship' ? <TrophyIcon className="h-5 w-5 text-amber-500" /> : <UsersIcon className="h-5 w-5 text-teal-600" />}
            {pathwayInfo.pathway.type === 'series_championship' ? 'Series standings' : 'National & state rankings'}
          </h2>
          <PathwayStandings pathway={pathwayInfo.pathway} entries={entries} standings={seriesStandings} />
        </div>
      )}

      {panel?.results_locked && (
        <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-8">
          {auditReview?.status !== 'signed_off' ? (
            <div className="flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-5">
              <ScrollText className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
              <div>
                <h2 className="font-heading text-lg font-bold text-amber-800">Results pending independent audit</h2>
                <p className="mt-1 text-sm text-stone-600">Final placings are verified but not yet announced. Winners and prize payouts are held until the audit sign-off is complete.</p>
              </div>
            </div>
          ) : (
            <>
              <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
                <div className="flex flex-wrap items-center gap-3">
                  <BadgeCheck className="h-5 w-5 text-emerald-600" />
                  <span className="font-heading text-lg font-bold text-emerald-800">Independently audited</span>
                  <span className="text-xs text-stone-500">Signed off{auditReview?.sign_off_at ? ' ' + new Date(auditReview.sign_off_at).toLocaleDateString() : ''} by {auditReview?.sign_off_name}</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-stone-600">
                  <span><b className="text-stone-900">Judging method:</b> Blind judging &mdash; {Math.round((panel?.judge_weight ?? 0.7) * 100)}% judging / {Math.round((panel?.public_weight ?? 0.3) * 100)}% public vote</span>
                  {panel?.criteria?.length > 0 && <span><b className="text-stone-900">Criteria:</b> {panel.criteria.map((c) => c.name).join(' / ')}</span>}
                </div>
                {judges.length > 0 && (
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-stone-600">
                    <UsersIcon className="h-3.5 w-3.5" />
                    <b className="text-stone-900">Judge credits:</b>
                    {judges.map((j) => (
                      <span key={j.id} className="rounded-full bg-white px-2.5 py-0.5 text-xs font-semibold text-stone-700 ring-1 ring-stone-200">{j.name}</span>
                    ))}
                  </div>
                )}
                {auditReview?.routed_to && (
                  <p className="mt-2 text-xs text-orange-700">Routing for resolution: {auditReview.routed_to} / re-audit #{auditReview.re_audit_count}</p>
                )}
              </div>

              {combined.rows.length > 0 && (
                <>
                  <h2 className="mb-3 flex items-center gap-2 font-heading text-xl font-bold text-stone-900"><TrophyIcon className="h-5 w-5 text-amber-500" /> Final results</h2>
                  <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
                    <ol className="divide-y divide-stone-100">
                      {combined.rows.map((r) => {
                        const e = entries.find((en) => en.id === r.entry_id);
                        const top = r.combined_rank <= 3;
                        return (
                          <li key={r.entry_id} className="flex items-center justify-between gap-3 px-4 py-3">
                            <div className="flex min-w-0 items-center gap-3">
                              <span className={'grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-extrabold ' + (top ? 'bg-orange-500 text-white' : 'bg-stone-100 text-stone-600')}>{r.combined_rank}</span>
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-stone-900">{e?.title || r.entry_title || ('Entry ' + r.entry_id)}</p>
                                <p className="text-xs text-stone-500">{e?.creator_name || r.creator_name || ''}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-4 text-xs text-stone-500">
                              <span>Judge <b className="text-stone-900">{r.judge_score.toFixed(1)}</b></span>
                              <span>Public <b className="text-stone-900">{r.public_score.toFixed(1)}</b> <span className="opacity-60">({r.public_votes}v)</span></span>
                              <span className="font-heading text-lg font-extrabold text-teal-700">{r.combined_score.toFixed(2)}</span>
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

      <DiscoverToolbar
        search={search} setSearch={setSearch}
        division={division} setDivision={setDivision}
        state={state} setState={setState}
        sort={sort} setSort={setSort}
        states={presentStates}
        onReset={reset}
        resultCount={list.length}
        loading={loading}
      />

      <div className="mx-auto w-full max-w-3xl space-y-4 px-4 py-6 pb-16 sm:px-8">
        {list.length ? (
          list.map((e, i) => (
            <VoteCard
              key={e.id}
              entry={e}
              rank={i + 1}
              index={i}
              finished={finished}
              isActive={!finished}
              complianceBlocked={complianceBlocked}
              challengeTheme={title}
              search={search}
              onOpen={openLightbox}
              votedEntryIds={votedIds}
              onVoted={onVoted}
              initialCount={voteCounts[e.id] ?? e.community_votes ?? e.vote_count ?? 0}
              commentCount={commentCounts[e.id] || 0}
            />
          ))
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-orange-100 text-4xl">
              {hasFilters ? '🔍' : '🎨'}
            </div>
            <p className="text-xl font-bold text-stone-900">
              {hasFilters ? 'No entries match just yet' : 'Finalists will appear here after review'}
            </p>
            <p className="mt-2 max-w-sm text-base text-stone-600">
              {hasFilters
                ? 'Try a different search term or clear a filter. Your favourite might be one chip away.'
                : 'Approved entries from this challenge show up here once our team has reviewed them.'}
            </p>
            {hasFilters && (
              <button
                type="button"
                onClick={reset}
                className="mt-5 min-h-[44px] rounded-full bg-teal-600 px-6 font-semibold text-white transition-colors hover:bg-teal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
              >
                Clear All Filters
              </button>
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
