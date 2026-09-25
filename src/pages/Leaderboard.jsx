import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Trophy, MapPin, Award, Activity, ShieldCheck } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { challengeApi } from '@/lib/challengeApi';
import { categoryMeta, challengePhase, STATES } from '@/lib/challenges-data';
import { getCombinedResults } from '@/lib/votes';
import { getSeriesStandings } from '@/lib/pathways';
import RevealOnScroll from '@/components/home/RevealOnScroll';

// Rankings page — built from VERIFIED results: audited CombinedResult champions
// and SeriesStanding points. The "Live vote activity" strip uses competition
// totals (clearly labelled as provisional/unverified) for context only.
export default function Leaderboard() {
  const [champions, setChampions] = useState([]);
  const [standings, setStandings] = useState([]);
  const [live, setLive] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      setLoading(true); setError('');
      try {
        const [chs, sts] = await Promise.all([
          challengeApi.listChallenges({ status: 'active', limit: 200 }).then((r) => r?.challenges || []).catch(() => []),
          base44.entities.SeriesStanding.list('-total_points', 200).catch(() => []),
        ]);
        // Audited champions: stop-3 across competitions with locked combined results.
        const audited = chs.filter((c) => challengePhase(c) === 'closed');
        const championRows = await Promise.all(audited.map(async (c) => {
          const cr = await getCombinedResults(c.id).catch(() => ({ rows: [] }));
          return cr.rows.filter((r) => r.combined_rank && r.combined_rank <= 3)
            .map((r) => ({ ...r, challenge: c }));
        }));
        setChampions(championRows.flat().sort((a, b) => (a.combined_rank || 9) - (b.combined_rank || 9)).slice(0, 12));
        setStandings(sts || []);
        // Live (unverified) vote activity for context — total_votes per live competition.
        setLive(chs.filter((c) => challengePhase(c) !== 'closed')
          .sort((a, b) => (b.total_votes || 0) - (a.total_votes || 0)));
      } catch (e) {
        setError(e?.message || 'Could not load rankings.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Aggregate verified points by state from SeriesStanding.
  const pointsByState = {};
  for (const s of standings) {
    if (!s.state) continue;
    pointsByState[s.state] = (pointsByState[s.state] || 0) + (s.total_points || 0);
  }
  const stateRows = STATES.map((st) => ({ state: st, pts: pointsByState[st] || 0 })).sort((a, b) => b.pts - a.pts);
  const maxPts = stateRows[0]?.pts || 1;
  const topCreators = (standings || []).slice(0, 8);

  return (
    <div className="container-tight py-12">
      <div className="text-center">
        <p className="text-sm font-semibold uppercase tracking-wider text-primary">Rankings</p>
        <h1 className="mt-2 font-heading text-4xl font-extrabold sm:text-5xl">Represent your state. Compete for Australia.</h1>
        <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">National champions earn the gold. Rankings are built from independently audited competition results.</p>
      </div>

      {error && <p className="mt-8 rounded-xl bg-destructive/10 px-4 py-3 text-center text-sm font-medium text-destructive">{error}</p>}

      {/* State rankings — verified points */}
      <section className="mt-12">
        <h2 className="flex items-center gap-2 font-heading text-xl font-bold"><MapPin className="h-5 w-5 text-primary" /> State rankings</h2>
        {standings.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No verified standings computed yet — rankings appear after competitions close and are audited.</p>
        ) : (
          <div className="mt-5 overflow-hidden rounded-2xl border border-border bg-card">
            <ol className="divide-y divide-border">
              {stateRows.map((r, i) => (
                <li key={r.state} className="flex items-center gap-3 px-4 py-3">
                  <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-extrabold ${i < 3 ? 'grad-bg text-white' : 'bg-muted text-muted-foreground'}`}>{i + 1}</span>
                  <span className="flex items-center gap-1.5 text-sm font-semibold"><MapPin className="h-3.5 w-3.5 text-primary" /> {r.state}</span>
                  <div className="ml-2 h-2 flex-1 overflow-hidden rounded-full bg-muted">
                    <motion.div initial={{ width: 0 }} whileInView={{ width: `${Math.max(3, (r.pts / maxPts) * 100)}%` }} viewport={{ once: true }} transition={{ duration: 1, ease: 'easeOut' }} className="h-full rounded-full bg-primary" />
                  </div>
                  <span className="w-24 text-right text-xs font-semibold text-muted-foreground">{r.pts.toLocaleString()} pts</span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </section>

      <div className="mt-12 grid gap-8 lg:grid-cols-2">
        {/* Audited champions */}
        <section>
          <h2 className="flex items-center gap-2 font-heading text-xl font-bold"><Trophy className="h-5 w-5 text-amber-400" /> Audited champions</h2>
          {loading ? (
            <div className="mt-5 space-y-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-16 animate-pulse rounded-2xl bg-muted" />)}</div>
          ) : champions.length ? (
            <RevealOnScroll stagger className="mt-5 space-y-3">
              {champions.map((r) => (
                <Link key={r.entry_id} to={`/challenges/${r.challenge?.id}`} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 transition hover:border-primary/40">
                  <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-extrabold ${r.combined_rank <= 3 ? 'grad-bg text-white' : 'bg-muted text-muted-foreground'}`}>#{r.combined_rank}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{r.entry_title || r.creator_name || 'Untitled'}</p>
                    <p className="truncate text-xs text-muted-foreground">{r.creator_name} · {r.challenge?.theme || r.challenge?.title}</p>
                  </div>
                  <ShieldCheck className="h-4 w-4 text-emerald-400" />
                  <span className="font-heading text-sm font-extrabold text-primary">{r.combined_score.toFixed(2)}</span>
                </Link>
              ))}
            </RevealOnScroll>
          ) : (
            <div className="mt-5 rounded-2xl border border-dashed border-border py-10 text-center text-sm text-muted-foreground">No audited champions yet — winners appear here once competitions close and pass independent audit.</div>
          )}
        </section>

        {/* Verified creator standings */}
        <section>
          <h2 className="flex items-center gap-2 font-heading text-xl font-bold"><Award className="h-5 w-5 text-primary" /> Creator standings</h2>
          {topCreators.length ? (
            <div className="mt-5 overflow-hidden rounded-2xl border border-border bg-card">
              <ol className="divide-y divide-border">
                {topCreators.map((r, i) => (
                  <li key={r.id || i} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-extrabold ${i < 3 ? 'grad-bg text-white' : 'bg-muted text-muted-foreground'}`}>{i + 1}</span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{r.creator_name}</p>
                        <p className="text-xs text-muted-foreground">{r.events_counted || 0} events · best #{r.best_placing || '—'}{r.state ? ` · ${r.state}` : ''}</p>
                      </div>
                    </div>
                    <span className="font-heading font-extrabold text-primary">{r.total_points.toLocaleString()}<span className="ml-1 text-xs font-normal text-muted-foreground">pts</span></span>
                  </li>
                ))}
              </ol>
            </div>
          ) : (
            <div className="mt-5 rounded-2xl border border-dashed border-border py-10 text-center text-sm text-muted-foreground">No verified standings yet.</div>
          )}
        </section>
      </div>

      {/* Live (unverified) vote activity */}
      {live.length > 0 && (
        <section className="mt-12">
          <h2 className="flex items-center gap-2 font-heading text-xl font-bold"><Activity className="h-5 w-5 text-muted-foreground" /> Live vote activity <span className="text-xs font-normal text-muted-foreground">(unverified · provisional)</span></h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {live.slice(0, 6).map((c) => {
              const cat = categoryMeta(c.category);
              return (
                <Link key={c.id} to={`/challenges/${c.id}`} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 transition hover:border-primary/40">
                  <span className="grid h-10 w-10 place-items-center rounded-xl text-xl" style={{ backgroundColor: cat.color + '22' }}>{cat.icon}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{c.theme || c.title}</p>
                    <p className="text-xs text-muted-foreground">{challengePhase(c) === 'vote' ? 'Voting now' : challengePhase(c) === 'submit' ? 'Open for entries' : 'Live'}</p>
                  </div>
                  <span className="text-xs font-semibold text-muted-foreground">{(c.total_votes || 0).toLocaleString()} votes</span>
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}