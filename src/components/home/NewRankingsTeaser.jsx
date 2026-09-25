import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { Trophy, MapPin, ArrowRight, Award, Flag } from 'lucide-react';
import { STATES } from '@/lib/challenges-data';
import RevealOnScroll from '@/components/home/RevealOnScroll';
import AnimatedCounter from '@/components/home/AnimatedCounter';
import { DURATION, EASE, STAGGER } from '@/lib/motion';

// Approximate state positions on the simplified Australia map (viewBox 0 0 120 90).
const STATE_DOTS = {
  WA:  { x: 26, y: 48 },
  NT:  { x: 52, y: 25 },
  SA:  { x: 50, y: 52 },
  QLD: { x: 72, y: 28 },
  NSW: { x: 70, y: 52 },
  VIC: { x: 62, y: 64 },
  TAS: { x: 56, y: 76 },
  ACT: { x: 68, y: 55 },
};

// Simplified Australia mainland silhouette path.
const AUS_PATH =
  'M 15,32 C 22,27 32,24 44,22 C 54,20 62,17 70,17 C 78,17 85,20 88,24 L 91,28 C 94,32 92,36 90,38 L 87,42 C 85,44 87,48 89,50 C 91,55 88,60 84,64 C 78,70 68,73 56,73 C 44,73 32,71 24,65 C 15,58 9,48 11,38 C 12,35 13,33 15,32 Z';

/**
 * Leaderboard strip with an Australia map silhouette and 8 state ranking cards.
 * Falls back to "Season starting soon" if no verified points exist.
 */
export default function NewRankingsTeaser({ standings = [] }) {
  const reduced = useReducedMotion();

  const pointsByState = {};
  for (const s of standings) {
    if (!s.state) continue;
    pointsByState[s.state] = (pointsByState[s.state] || 0) + (s.total_points || 0);
  }
  const rows = STATES.map((st) => ({ state: st, pts: pointsByState[st] || 0 })).sort((a, b) => b.pts - a.pts);
  const hasRealPoints = rows.some((r) => r.pts > 0);
  const list = hasRealPoints ? rows : rows; // always show 8 cards; zeros read as "starting"

  return (
    <RevealOnScroll as="section" className="container-tight py-14 lg:py-16">
      <div className="mb-8 text-center">
        <p className="text-sm font-semibold uppercase tracking-wider text-primary">State &amp; National Rankings</p>
        <h2 className="mt-2 font-heading text-3xl font-bold text-balance sm:text-4xl">
          Represent your state. Compete for Australia.
        </h2>
        <p className="mt-3 flex items-center justify-center gap-2 text-lg font-semibold text-gold">
          <Award className="h-5 w-5" /> National Champions Earn the Gold.
        </p>
      </div>

      <div className="grid items-center gap-10 lg:grid-cols-[0.9fr_1.1fr]">
        {/* Australia map */}
        <div className="flex justify-center">
          <svg viewBox="0 0 120 90" className="w-full max-w-sm" role="img" aria-label="Map of Australia">
            <path
              d={AUS_PATH}
              className="fill-primary/10"
              stroke="hsl(var(--primary))"
              strokeWidth="0.5"
              strokeOpacity="0.3"
            />
            <ellipse cx="55" cy="80" rx="4" ry="3" className="fill-primary/10" stroke="hsl(var(--primary))" strokeWidth="0.5" strokeOpacity="0.3" />
            {STATES.map((st) => {
              const pos = STATE_DOTS[st];
              const pts = pointsByState[st] || 0;
              const isTop = hasRealPoints && rows[0]?.state === st;
              return (
                <g key={st}>
                  <circle
                    cx={pos.x}
                    cy={pos.y}
                    r={isTop ? 2.5 : 1.8}
                    fill={isTop ? 'hsl(var(--gold))' : 'hsl(var(--primary))'}
                  />
                  <text
                    x={pos.x}
                    y={pos.y - 3}
                    textAnchor="middle"
                    className="fill-foreground"
                    style={{ fontSize: '3.5px', fontWeight: 700, opacity: 0.6 }}
                  >
                    {st}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* State ranking cards */}
        {hasRealPoints ? (
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {list.map((r, i) => (
              <motion.div
                key={r.state}
                initial={reduced ? { opacity: 0 } : { opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ duration: DURATION.base, ease: EASE.out, delay: reduced ? 0 : i * STAGGER.fast }}
                className={`flex flex-col items-center rounded-xl border p-3 text-center transition ${
                  i === 0
                    ? 'border-gold/50 bg-gold/10'
                    : 'border-border bg-card'
                }`}
              >
                <span
                  className={`grid h-7 w-7 place-items-center rounded-full text-xs font-extrabold ${
                    i === 0 ? 'bg-gold text-stone-900' : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {i + 1}
                </span>
                <span className="mt-2 flex items-center gap-1 text-sm font-bold">
                  <MapPin className="h-3 w-3 text-primary" /> {r.state}
                </span>
                <span className="mt-1 text-xs font-semibold text-muted-foreground">
                  <AnimatedCounter value={r.pts} /> pts
                </span>
              </motion.div>
            ))}
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
              Follow Your State
            </Link>
          </div>
        )}
      </div>

      <div className="mt-8 text-center">
        <Link
          to="/leaderboard"
          className="btn-bounce inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3.5 text-sm font-bold text-primary-foreground transition hover:-translate-y-0.5 hover:brightness-110"
        >
          <Trophy className="h-4 w-4" /> View full leaderboard <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </RevealOnScroll>
  );
}