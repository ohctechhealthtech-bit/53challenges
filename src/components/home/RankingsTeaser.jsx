import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { Trophy, MapPin, ArrowRight, Award, Bell, Flag } from 'lucide-react';
import { STATES } from '@/lib/challenges-data';
import RevealOnScroll from '@/components/home/RevealOnScroll';
import AnimatedCounter from '@/components/home/AnimatedCounter';
import { DURATION, EASE, STAGGER } from '@/lib/motion';

/**
 * State & National Rankings teaser.
 * - If at least one state has verified points (> 0), show the leaderboard
 *   with animated number counters and progress bars.
 * - If all states have zero points, show a "Season starting soon" panel
 *   with a "Follow Your State" action instead of a zero-only leaderboard.
 */
export default function RankingsTeaser({ standings = [] }) {
  const reduced = useReducedMotion();

  const pointsByState = {};
  for (const s of standings) {
    if (!s.state) continue;
    pointsByState[s.state] = (pointsByState[s.state] || 0) + (s.total_points || 0);
  }
  const rows = Object.entries(pointsByState).map(([state, pts]) => ({ state, pts })).sort((a, b) => b.pts - a.pts);
  const hasRealPoints = rows.some((r) => r.pts > 0);
  const list = hasRealPoints ? rows.slice(0, 8) : [];
  const max = list[0]?.pts || 1;

  return (
    <RevealOnScroll as="section" className="container-tight py-14 lg:py-16">
      <div className="grid gap-10 lg:grid-cols-[1fr_1.1fr]">
        <div className="flex flex-col justify-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-primary">State & National Rankings</p>
          <h2 className="mt-2 font-heading text-3xl font-bold text-balance sm:text-4xl">
            Represent your state. Compete for Australia.
          </h2>
          <p className="mt-3 flex items-center gap-2 text-lg font-semibold text-amber-300">
            <Award className="h-5 w-5" /> National Champions Earn the Gold.
          </p>
          <p className="mt-3 text-muted-foreground">
            Rankings are built from independently audited competition results — not raw vote counts.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            {STATES.map((st) => (
              <span
                key={st}
                className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-bold text-muted-foreground"
              >
                <MapPin className="h-3 w-3 text-primary" /> {st}
              </span>
            ))}
          </div>
          <Link
            to="/leaderboard"
            className="btn-bounce mt-7 inline-flex items-center gap-2 self-start rounded-xl bg-primary px-6 py-3.5 text-sm font-bold text-primary-foreground transition hover:-translate-y-0.5 hover:brightness-110"
          >
            <Trophy className="h-4 w-4" /> View full leaderboard <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {hasRealPoints ? (
          <div className="rounded-3xl border border-border bg-card p-6">
            <ol className="space-y-1.5">
              {list.map((r, i) => (
                <motion.li
                  key={r.state}
                  initial={reduced ? { opacity: 0 } : { opacity: 0, x: 16 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, amount: 0.3 }}
                  transition={{ duration: DURATION.base, ease: EASE.out, delay: reduced ? 0 : i * STAGGER.fast }}
                  className="flex items-center gap-3 rounded-xl px-2 py-1.5 transition hover:bg-secondary"
                >
                  <span
                    className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-extrabold ${
                      i < 3 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {i + 1}
                  </span>
                  <span className="flex items-center gap-1.5 text-sm font-bold">
                    <MapPin className="h-3.5 w-3.5 text-primary" /> {r.state}
                  </span>
                  <div className="ml-auto h-2 w-28 overflow-hidden rounded-full bg-muted">
                    <motion.div
                      className="h-full rounded-full bg-primary"
                      initial={reduced ? { width: `${Math.max(4, (r.pts / max) * 100)}%` } : { width: 0 }}
                      whileInView={{ width: `${Math.max(4, (r.pts / max) * 100)}%` }}
                      viewport={{ once: true }}
                      transition={{ duration: DURATION.section, ease: EASE.out, delay: reduced ? 0 : i * STAGGER.fast + 0.1 }}
                    />
                  </div>
                  <span className="w-24 text-right text-xs font-semibold text-muted-foreground">
                    <AnimatedCounter value={r.pts} /> pts
                  </span>
                </motion.li>
              ))}
            </ol>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-border bg-card/50 p-10 text-center">
            <Flag className="h-12 w-12 text-primary/60" />
            <h3 className="mt-4 font-heading text-xl font-bold">Season Starting Soon</h3>
            <p className="mt-2 max-w-sm text-sm text-muted-foreground">
              The new competition season is being prepared. State rankings will appear here once the
              first verified results are in.
            </p>
            <Link
              to="/coming-soon"
              className="btn-bounce mt-5 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground transition hover:brightness-110"
            >
              <Bell className="h-4 w-4" /> Follow Your State
            </Link>
          </div>
        )}
      </div>
    </RevealOnScroll>
  );
}