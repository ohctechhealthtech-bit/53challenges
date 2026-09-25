import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { getCombinedResults } from '@/lib/votes';
import { challengeApi } from '@/lib/challengeApi';
import { challengePhase } from '@/lib/challenges-data';
import RevealOnScroll from '@/components/home/RevealOnScroll';
import HallOfFameHero from '@/components/halloffame/HallOfFameHero';
import ChampionCard from '@/components/halloffame/ChampionCard';
import LiveLeaderboard from '@/components/halloffame/LiveLeaderboard';
import TopParticipants from '@/components/halloffame/TopParticipants';

// Hall of Fame shows only independently audited winners — CombinedResult rank 1
// from locked, audit-signed-off competitions. No manual is_winner flags.
export default function HallOfFame() {
  const [winners, setWinners] = useState([]);
  const [leaders, setLeaders] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [loading, setLoading] = useState(true);

  // Live leaderboard + participant standings from real entries and votes.
  // Refreshes on new votes (realtime subscription) and every 60s.
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const data = await challengeApi.latestEntries(100);
        if (cancelled || !data?.entries) return;
        const entries = data.entries;
        setLeaders([...entries].sort((a, b) => (b.community_votes || 0) - (a.community_votes || 0)).slice(0, 10));
        const byCreator = {};
        for (const e of entries) {
          const name = (e.creator_name || '').trim();
          if (!name) continue;
          if (!byCreator[name]) byCreator[name] = { name, state: e.state || '', entries: 0, votes: 0 };
          byCreator[name].entries += 1;
          byCreator[name].votes += e.community_votes || 0;
        }
        setParticipants(Object.values(byCreator)
          .sort((a, b) => b.votes - a.votes || b.entries - a.entries)
          .slice(0, 8));
      } catch { /* keep last good data */ }
    };
    load();
    const timer = setInterval(load, 60_000);
    let unsubscribe = () => {};
    try {
      unsubscribe = base44.entities.Vote.subscribe(() => load());
    } catch { /* realtime unavailable — polling covers it */ }
    return () => { cancelled = true; clearInterval(timer); unsubscribe(); };
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const chs = (await challengeApi.listChallenges({ status: 'active', limit: 200 }).then((r) => r?.challenges || []).catch(() => []));
        // Only closed (audited) competitions can produce champions.
        const closed = chs.filter((c) => challengePhase(c) === 'closed');
        const rows = await Promise.all(closed.map(async (c) => {
          const cr = await getCombinedResults(c.id).catch(() => ({ rows: [] }));
          return cr.rows.filter((r) => r.combined_rank === 1).map((r) => ({ ...r, challenge: c }));
        }));
        const champs = rows.flat()
          .sort((a, b) => (b.combined_score || 0) - (a.combined_score || 0))
          .slice(0, 50);
        // Also surface any locked SeriesStanding rank-1 season champions.
        const sstandings = await base44.entities.SeriesStanding.list('-total_points', 200).catch(() => []);
        const seriesChamps = (sstandings || []).filter((s) => s.rank === 1).map((s) => ({
          entry_title: s.creator_name, creator_name: s.creator_name, combined_score: s.total_points,
          challenge: { theme: 'Series Champion', category: '' }, series: true, state: s.state,
        }));
        setWinners([...champs, ...seriesChamps]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const featured = winners.slice(0, 3);
  const rest = winners.slice(3);

  return (
    <div>
      <HallOfFameHero count={winners.length} />

      <div className="container-tight py-14">
        {loading ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-56 animate-pulse rounded-3xl bg-muted" />)}
          </div>
        ) : winners.length ? (
          <>
            <RevealOnScroll stagger className="grid gap-6 md:grid-cols-3">
              {featured.map((w, i) => (
                <ChampionCard key={(w.entry_id || 'f') + i} champion={w} position={i + 1} featured />
              ))}
            </RevealOnScroll>

            {rest.length > 0 && (
              <>
                <div className="my-14 flex items-center gap-4">
                  <span className="h-px flex-1 bg-gradient-to-r from-transparent to-amber-400/40" />
                  <p className="text-xs font-bold uppercase tracking-[0.3em] text-amber-300/80">The Roll of Honour</p>
                  <span className="h-px flex-1 bg-gradient-to-l from-transparent to-amber-400/40" />
                </div>
                <RevealOnScroll stagger className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {rest.map((w, i) => (
                    <ChampionCard key={(w.entry_id || 'r') + i} champion={w} position={i + 4} />
                  ))}
                </RevealOnScroll>
              </>
            )}
          </>
        ) : leaders.length === 0 && participants.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-amber-400/30 bg-amber-500/[0.03] py-20 text-center">
            <div className="text-5xl">🏆</div>
            <p className="mt-4 font-heading text-xl font-bold">The first name is yet to be engraved</p>
            <p className="mx-auto mt-2 max-w-md text-muted-foreground">Audited champions are inducted here once competitions close and pass independent audit.</p>
            <Link to="/challenges" className="mt-7 inline-flex items-center rounded-full border border-amber-400/40 bg-amber-500/10 px-6 py-3 text-sm font-bold text-amber-200 transition hover:bg-amber-500/20">
              Browse live challenges
            </Link>
          </div>
        ) : null}

        <LiveLeaderboard entries={leaders} />
        <TopParticipants participants={participants} />
      </div>
    </div>
  );
}