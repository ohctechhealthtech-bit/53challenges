import { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Image } from '@/components/ui/image';

const NAVY = '#0a192f';
const GOLD = '#d4af37';
const RANK_COLOR = ['#d4af37', '#c0c0c0', '#cd7f32'];

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

const CARD_ACCENTS = ['#1D63ED', '#E86A33', '#3BA55D', '#D4537E', '#F0932B', '#12B5A5', '#8E44FF', '#1BA39C'];

function useReveal() {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') { el.classList.add('is-visible'); return; }
    const obs = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) { el.classList.add('is-visible'); obs.unobserve(el); } }),
      { threshold: 0.12 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return ref;
}

const PARTNER = [
  {
    icon: '🏆',
    color: '#E11D48',
    title: 'Sponsor a Challenge',
    body: 'Align your brand with purpose and communities Australia-wide.',
    link: 'Explore Sponsorships',
    to: '/run-a-challenge',
  },
  {
    icon: '⚑',
    color: '#14B8A6',
    title: 'Host a Challenge',
    body: 'Run your own competition with our trusted platform and support.',
    link: 'Learn More',
    to: '/host-a-challenge',
  },
  {
    icon: '👥',
    color: '#F59E0B',
    title: 'Managed by 53',
    body: 'We manage it all—promotion, entries, judging and engagement.',
    link: 'Request a Proposal',
    to: '/run-a-challenge',
  },
];

export default function StatePartnerSection() {
  const [rows, setRows] = useState([]);
  const leftRef = useReveal();
  const rightRef = useReveal();

  useEffect(() => {
    (async () => {
      const standings = await base44.entities.SeriesStanding.list('-total_points', 200).catch(() => []);
      const pts = {};
      for (const s of standings || []) {
        if (!s.state) continue;
        pts[s.state] = (pts[s.state] || 0) + (s.total_points || 0);
      }
      const all = Object.keys(STATE_NAMES).map((st) => ({ state: st, pts: pts[st] || 0 })).sort((a, b) => b.pts - a.pts);
      setRows(all);
    })();
  }, []);

  const hasData = rows.some((r) => r.pts > 0);
  const top3 = rows.filter((r) => r.pts > 0).slice(0, 3);

  return (
    <section className="mx-auto max-w-7xl px-4 py-3 sm:px-6 sm:py-4">
      <div data-reveal className="grid grid-cols-1 overflow-hidden rounded-2xl shadow-lg lg:grid-cols-2">

        {/* ── LEFT: State Leaderboard (dark navy) ── */}
        <div
          ref={leftRef}
          className="reveal-left flex flex-col p-6 sm:p-8"
          style={{ backgroundColor: NAVY }}
        >
          <h2 className="text-xl font-extrabold leading-tight text-white sm:text-2xl">
            Represent your state.
            <br />
            Compete for Australia.
          </h2>
          <p style={{ color: GOLD }} className="mt-1 text-sm font-semibold">
            National Champions Earn the Gold.
          </p>

          <div className="mt-4 flex flex-1 flex-col items-center gap-5 sm:flex-row">
            {/* Australia map */}
            <div className="w-full max-w-[220px] shrink-0">
              <div className="relative aspect-[5/4] w-full">
                <Image
                  src="https://media.base44.com/images/public/6a683318ec3c2cc96e77b420/dd5936e91_Screenshot_2026-08-05_172749-removebg-preview.png"
                  alt="Map of Australia showing all states and territories"
                  fittingType="fit"
                  className="absolute inset-0 h-full w-full opacity-90"
                />
              </div>
            </div>

            {/* Top 3 leaderboard */}
            <div className="w-full flex-1">
              <p className="text-xs font-bold uppercase tracking-widest text-white/70">Top 3 on the leaderboard</p>
              {hasData && top3.length > 0 ? (
                <div className="mt-3 grid grid-cols-3 divide-x" style={{ borderColor: '#3a4a5e' }}>
                  {top3.map((row, i) => (
                    <Link
                      key={row.state}
                      to={`/challenges?state=${row.state}`}
                      className="flex flex-col items-center rounded-lg px-2 py-1.5 text-center transition hover:bg-white/10"
                      style={{ borderColor: '#3a4a5e' }}
                      title={`View challenges in ${row.state}`}
                    >
                      <span className="text-3xl font-extrabold sm:text-4xl" style={{ color: RANK_COLOR[i] || '#ffffff' }}>
                        {i + 1}
                      </span>
                      <span className="mt-1 text-sm font-bold text-white sm:text-base">{row.state}</span>
                      <span className="mt-0.5 text-[11px] font-semibold text-white/80 sm:text-xs">
                        {row.pts.toLocaleString()} pts
                      </span>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-sm text-white/60">
                  Rankings appear once the first competitions close and are independently audited.
                </p>
              )}
              <Link
                to="/leaderboard"
                className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-white/80 transition hover:text-white"
              >
                View full leaderboard <ChevronRight size={14} />
              </Link>

              {hasData && rows.length > 3 && (
                <div className="c53-ticker-pause mt-4 w-full overflow-hidden border-t border-white/10 pt-3">
                  <div className="c53-ticker-track flex w-max gap-6">
                    {[...rows, ...rows].map((r, i) => (
                      <span key={i} className="whitespace-nowrap text-xs font-semibold text-white/70">
                        <span style={{ color: GOLD }}>{r.state}</span> {r.pts.toLocaleString()} pts
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── RIGHT: Partner Services (light) ── */}
        <div
          ref={rightRef}
          className="reveal-right flex flex-col justify-center bg-white p-6 sm:p-8"
          style={{ transitionDelay: '120ms' }}
        >
          <h2 className="text-lg font-extrabold leading-tight tracking-tight text-slate-900 sm:text-xl">
            Partner with Australia's leading competition platform.
          </h2>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {PARTNER.map((p) => (
              <div
                key={p.title}
                className="flex flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md"
              >
                <span
                  style={{ backgroundColor: p.color }}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg"
                >
                  {p.icon}
                </span>
                <h3 className="mt-2.5 font-bold text-slate-900">{p.title}</h3>
                <p className="mt-1 text-xs text-slate-500">{p.body}</p>
                <Link
                  to={p.to}
                  className="mt-2.5 flex items-center text-xs font-semibold"
                  style={{ color: p.color }}
                >
                  {p.link} <ChevronRight size={12} />
                </Link>
              </div>
            ))}
          </div>
        </div>

      </div>
    </section>
  );
}