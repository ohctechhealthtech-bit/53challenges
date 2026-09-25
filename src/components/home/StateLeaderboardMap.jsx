import { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { STATES } from '@/lib/challenges-data';
import { Image } from '@/components/ui/image';

// Reveal-on-scroll hook — adds a "slide in from left" effect when the
// section enters the viewport. Respects prefers-reduced-motion.
function useRevealLeft() {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      el.classList.add('is-visible');
      return;
    }
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            el.classList.add('is-visible');
            obs.unobserve(el);
          }
        });
      },
      { threshold: 0.15 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return ref;
}

// All 8 Australian states — full leaderboard teaser + stylized map.
// Points come from verified SeriesStanding records (aggregated by state).

const RED = '#ff3b3b';
const TEAL = '#00d1c1';
const GOLD = '#ffce54';
const BRONZE = '#C27339';
const PANEL = '#f4f7fa';
const INK = '#1A2333';

// Approx. centre of each state on the simplified Australia SVG (viewBox 520x460).
const STATE_GEO = {
  WA:  { x: 215, y: 235, label: 'WA' },
  NT:  { x: 295, y: 168, label: 'NT' },
  SA:  { x: 270, y: 308, label: 'SA' },
  QLD: { x: 372, y: 220, label: 'QLD' },
  NSW: { x: 372, y: 312, label: 'NSW' },
  VIC: { x: 330, y: 352, label: 'VIC' },
  TAS: { x: 345, y: 412, label: 'TAS' },
  ACT: { x: 378, y: 332, label: 'ACT' },
};

const STATE_NAMES = {
  WA: 'Western Australia',
  NT: 'Northern Territory',
  SA: 'South Australia',
  QLD: 'Queensland',
  NSW: 'New South Wales',
  VIC: 'Victoria',
  TAS: 'Tasmania',
  ACT: 'Australian Capital Territory',
};

// Cycled accent colours for the stat cards — adds vibrancy across the grid.
const CARD_ACCENTS = [
  '#1D63ED', '#E86A33', '#3BA55D', '#D4537E',
  '#F0932B', '#12B5A5', '#8E44FF', '#1BA39C',
];

const RANK_COLOR = [GOLD, '#9ca3af', BRONZE];

// Simplified, recognisable Australia outline (mainland + Tasmania).
const AUSTRALIA_PATH =
  'M120,150 L150,120 L185,108 L220,118 L245,98 L270,120 L295,108 L330,96 L360,110 L385,132 ' +
  'L395,160 L388,185 L405,200 L410,235 L395,265 L410,295 L400,325 L380,350 L355,365 ' +
  'L325,372 L290,372 L255,365 L220,360 L190,355 L165,345 L145,325 L130,300 L122,270 ' +
  'L118,240 L122,210 L128,180 Z';
const TASMANIA_PATH = 'M330,400 L355,395 L360,420 L335,428 Z';

export default function StateLeaderboardMap() {
  const [rows, setRows] = useState([]);

  useEffect(() => {
    (async () => {
      const standings = await base44.entities.SeriesStanding.list('-total_points', 200).catch(() => []);
      const pts = {};
      for (const s of standings || []) {
        if (!s.state) continue;
        pts[s.state] = (pts[s.state] || 0) + (s.total_points || 0);
      }
      setRows(
        STATES.map((st) => ({ state: st, pts: pts[st] || 0 })).sort((a, b) => b.pts - a.pts)
      );
    })();
  }, []);

  const hasData = rows.some((r) => r.pts > 0);
  const maxPts = rows[0]?.pts || 1;

  const leftRef = useRevealLeft();
  const rightRef = useRevealLeft();

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-10">
      {/* Left — copy + full state leaderboard */}
      <div
        ref={leftRef}
        className="reveal-left"
        style={{ transitionDelay: '0ms' }}
      >
        <h2 className="text-xl font-extrabold leading-tight tracking-tight text-slate-900 sm:text-2xl">
          Represent your state.
          <br />
          Compete for Australia.
        </h2>
        <p style={{ color: BRONZE }} className="mt-1 font-semibold text-sm">
          National Champions Earn the Gold.
        </p>

        <div className="mt-4 grid grid-cols-4 gap-2 sm:gap-2.5">
          {rows.map((row, i) => {
            const isGold = i === 0;
            const isBronze = i === 2;
            const accent = isGold ? '#d4a373' : isBronze ? '#b87333' : CARD_ACCENTS[i % CARD_ACCENTS.length];
            const bg = isGold ? '#f0e8e0' : '#ffffff';
            return (
              <div
                key={row.state}
                className="flex flex-col items-center justify-center rounded-xl border bg-white px-2 py-2 text-center shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md sm:py-2.5"
                style={{ borderColor: accent, backgroundColor: bg, borderTopColor: accent, borderTopWidth: 4 }}
              >
                <span
                  className="text-base font-extrabold tracking-tight sm:text-lg"
                  style={{ color: accent }}
                >
                  {row.state}
                </span>
                <span className="mt-0.5 text-[9px] font-semibold leading-tight text-slate-500 sm:text-[10px]">
                  {STATE_NAMES[row.state] || ''}
                </span>
                <span className="mt-1 text-[10px] text-slate-400 sm:text-xs">
                  {hasData ? `${row.pts.toLocaleString()} pts` : '—'}
                </span>
              </div>
            );
          })}
        </div>

        <Link
          to="/leaderboard"
          className="mt-6 inline-flex items-center gap-1 text-sm font-semibold text-slate-600 transition hover:text-slate-900"
        >
          View full leaderboard <ChevronRight size={16} />
        </Link>
      </div>

      {/* Right — Australian map */}
      <div
        ref={rightRef}
        className="reveal-right flex items-center justify-center"
        style={{ transitionDelay: '150ms' }}
      >
        <div className="w-full max-w-sm">
          <div className="relative aspect-[5/4] w-full overflow-hidden rounded-2xl bg-transparent">
            <Image
              src="https://media.base44.com/images/public/6a683318ec3c2cc96e77b420/dd5936e91_Screenshot_2026-08-05_172749-removebg-preview.png"
              alt="Map of Australia showing all states and territories"
              fittingType="fit"
              className="absolute inset-0 h-full w-full"
            />
          </div>
          {!hasData && (
            <p className="mt-4 text-center text-xs text-slate-400">
              State rankings appear here once competitions close and are audited.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}