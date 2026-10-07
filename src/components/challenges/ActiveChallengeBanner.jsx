import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ChallengeLink from '@/components/challenges/ChallengeLink';
import { Trophy, Users, Heart, ArrowRight, Vote as VoteIcon } from 'lucide-react';
import { motion } from 'framer-motion';
import { challengeApi } from '@/lib/challengeApi';
import { useCategories } from '@/hooks/useCategories';
import {
  normalizeCategory,
  isPublicChallenge,
  categoryMeta,
  challengePhase,
  daysLeft,
} from '@/lib/challenges-data';

function useCountdown(deadline) {
  const [time, setTime] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  useEffect(() => {
    if (!deadline) return;
    const tick = () => {
      const diff = new Date(deadline).getTime() - Date.now();
      if (diff <= 0) { setTime({ days: 0, hours: 0, minutes: 0, seconds: 0 }); return; }
      setTime({
        days: Math.floor(diff / 86400000),
        hours: Math.floor((diff % 86400000) / 3600000),
        minutes: Math.floor((diff % 3600000) / 60000),
        seconds: Math.floor((diff % 60000) / 1000),
      });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [deadline]);
  return time;
}

const UNITS = [
  { key: 'days', label: 'Days' },
  { key: 'hours', label: 'Hrs' },
  { key: 'minutes', label: 'Min' },
  { key: 'seconds', label: 'Sec' },
];

const FALLBACK_THUMB =
  'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?auto=format&fit=crop&w=200&q=80';

function entryThumb(url) {
  if (!url) return FALLBACK_THUMB;
  const yt = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{11})/);
  if (yt) return `https://img.youtube.com/vi/${yt[1]}/mqdefault.jpg`;
  if (/\.(png|jpe?g|webp|gif)(\?|$)/i.test(url)) return url;
  return FALLBACK_THUMB;
}

export default function ActiveChallengeBanner() {
  const navigate = useNavigate();
  const { categories, loading: catsLoading } = useCategories();
  const [all, setAll] = useState([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { challenges: chs } = await challengeApi.listChallenges({ status: 'active', limit: 50 });
        setAll((chs || []).filter(isPublicChallenge));
      } catch {
        setAll([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Every featured challenge rotates first, then the soonest-ending active
  // challenge from each remaining category. Falls back to closed challenges
  // if none are visible, so the banner is never empty when challenges exist.
  const challenges = useMemo(() => {
    const soonest = (c) => {
      const p = challengePhase(c);
      if (p === 'upcoming') return daysLeft(c.starts_at);
      return daysLeft(c.submission_ends_at || c.end_date || c.voting_ends_at);
    };
    const isVisible = (c) => {
      const p = challengePhase(c);
      return p === 'submit' || p === 'vote' || p === 'upcoming';
    };

    const visible = all.filter(isVisible);
    const pool = visible.length ? visible : all;

    const featured = pool
      .filter((c) => c.is_featured === true)
      .sort((a, b) => soonest(a) - soonest(b));
    const featuredIds = new Set(featured.map((c) => c.id));

    const byCategory = {};
    for (const c of pool) {
      const slug = normalizeCategory(c.category);
      if (!byCategory[slug]) byCategory[slug] = [];
      byCategory[slug].push(c);
    }

    // Include every visible challenge (not just one per category) so the
    // rotation always has as many challenges as are available.
    const picked = pool.filter((c) => !featuredIds.has(c.id)).sort((a, b) => soonest(a) - soonest(b));

    return [...featured, ...picked];
  }, [all, categories]);

  // Auto-rotate through category challenges every 12 seconds.
  useEffect(() => {
    if (challenges.length <= 1) return;
    const id = setInterval(() => {
      setCurrentIdx((i) => (i + 1) % challenges.length);
    }, 12000);
    return () => clearInterval(id);
  }, [challenges.length]);

  const [topEntries, setTopEntries] = useState([]);
  const challenge = challenges[currentIdx] || challenges[0] || null;
  useEffect(() => {
    if (!challenge?.id) { setTopEntries([]); return; }
    // Clear stale entries immediately so the panel never shows entries
    // from a previous slide while the new ones load.
    setTopEntries([]);
    let cancelled = false;
    challengeApi.listEntries(challenge.id, { sort: 'popular', limit: 3 })
      .then((es) => { if (!cancelled) setTopEntries((es || []).filter((e) => e.creator_name)); })
      .catch(() => { if (!cancelled) setTopEntries([]); });
    return () => { cancelled = true; };
  }, [challenge?.id]);
  const phase = challenge ? challengePhase(challenge) : 'submit';
  const deadline = challenge ? (phase === 'vote' ? challenge.voting_ends_at : phase === 'upcoming' ? challenge.starts_at : challenge.submission_ends_at) : null;
  const time = useCountdown(deadline);

  // A first visit with nothing cached still has a moment before data lands.
  // This used to be a line of grey text in an otherwise empty band, and then
  // the whole hero popped in two seconds later. This holds the hero's shape
  // and height (same container, same vertical padding) so the page does not
  // reflow when the real one arrives. Repeat visits skip this entirely: the
  // request cache hands back the last result before the first paint.
  if (loading || catsLoading) {
    return (
      <section className="relative overflow-hidden bg-muted" aria-busy="true" aria-label="Loading challenges">
        <div className="container-tight relative py-12 sm:py-[76px]">
          <div className="animate-pulse space-y-4">
            <div className="h-6 w-40 rounded-full bg-foreground/10" />
            <div className="h-10 w-2/3 max-w-xl rounded-lg bg-foreground/10" />
            <div className="h-4 w-1/2 max-w-md rounded bg-foreground/10" />
            <div className="h-10 w-36 rounded-full bg-foreground/10" />
          </div>
        </div>
      </section>
    );
  }
  if (!challenge) return null;

  const cat = categoryMeta(challenge.category);
  const expired = deadline && new Date(deadline).getTime() <= Date.now();
  const entries = challenge.submission_count || 0;
  const votes = challenge.total_votes || 0;

  return (
    <section
      className="relative cursor-pointer overflow-hidden"
      onClick={(e) => {
        // Empty-space clicks open the challenge intro; real links/buttons keep their own behaviour.
        if (e.target.closest('a, button')) return;
        navigate(`/challenges/${challenge.id}`);
      }}
    >
      <div className="absolute inset-0" style={{ backgroundColor: cat.color }}>
        {challenge.cover_image && (
          <img src={challenge.cover_image} alt="" className="h-full w-full object-cover opacity-70" />
        )}
      </div>
      <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/30 to-background" />
      <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/45 to-transparent" />
      <div key={challenge.id} className="container-tight relative py-12 text-white sm:py-[76px]">
        <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_260px] lg:items-center lg:gap-10">
        <div>
        <motion.span
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-1.5 text-xs font-semibold backdrop-blur"
        >
          <span className={`h-2 w-2 animate-pulse rounded-full ${phase === 'upcoming' ? 'bg-amber-400' : phase === 'closed' ? 'bg-slate-400' : 'bg-emerald-400'}`} /> {phase === 'upcoming' ? 'Coming soon' : phase === 'closed' ? 'Completed' : 'Active now'} · {cat.icon} {cat.name}
        </motion.span>
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: 'easeOut', delay: 0.1 }}
          className="mt-5 max-w-3xl font-heading text-4xl font-extrabold leading-tight text-balance text-white drop-shadow-lg sm:text-5xl"
        >{challenge.theme}</motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut', delay: 0.2 }}
          className="mt-3 max-w-2xl text-white/85 drop-shadow"
        >{challenge.brief || challenge.title}</motion.p>

        <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-white/90">
          <span className="flex items-center gap-1.5"><Users className="h-4 w-4" /> {entries} entries</span>
          <span className="flex items-center gap-1.5"><Heart className="h-4 w-4" /> {votes} votes</span>
          {!expired && phase !== 'closed' && (
            <span className="flex items-center gap-1.5"><VoteIcon className="h-4 w-4" /> {daysLeft(deadline)}d {phase === 'vote' ? 'to vote' : phase === 'upcoming' ? 'to start' : 'to enter'}</span>
          )}
          {phase === 'closed' && (
            <span className="flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-0.5 text-xs font-semibold backdrop-blur">Completed</span>
          )}
        </div>

        {/* Countdown */}
        {!expired && phase !== 'closed' && (
          <div className="mt-7 flex items-center gap-3 sm:gap-5">
            {UNITS.map((u) => (
              <div key={u.key} className="text-center">
                <div className="relative inline-block overflow-hidden" style={{ lineHeight: 1 }}>
                  <p key={String(time[u.key]).padStart(2, '0')} className="c53-flip-in font-heading text-3xl font-extrabold tabular-nums sm:text-4xl">{String(time[u.key]).padStart(2, '0')}</p>
                </div>
                <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-white/70">{u.label}</p>
              </div>
            ))}
          </div>
        )}

        {phase !== 'closed' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut', delay: 0.3 }}
            className="mt-8 flex flex-wrap gap-3"
          >
            {(phase === 'submit' || phase === 'upcoming') && (
              <ChallengeLink challengeId={challenge.id} className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-bold text-background shadow-lg transition hover:-translate-y-0.5">
                <Trophy className="h-4 w-4" /> {phase === 'upcoming' ? 'Get ready' : 'Apply now'}
              </ChallengeLink>
            )}
            <ChallengeLink challengeId={challenge.id} className="inline-flex items-center gap-2 rounded-xl border border-white/30 bg-white/10 px-6 py-3 text-sm font-bold text-white backdrop-blur transition hover:bg-white/20">
              View finalists <ArrowRight className="h-4 w-4" />
            </ChallengeLink>
          </motion.div>
        )}
        </div>

        {topEntries.length > 0 && (
          <div className="mt-8 lg:mt-0">
            <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-white/70">
              <Trophy className="h-3.5 w-3.5" /> Leading entries
            </p>
            <div className="flex flex-wrap gap-3 lg:flex-col lg:flex-nowrap">
              {topEntries.map((e, i) => (
                <ChallengeLink
                  key={e.id || i}
                  challengeId={challenge.id}
                  className="group flex w-[230px] overflow-hidden rounded-xl border border-white/15 bg-black/30 backdrop-blur transition hover:-translate-y-1 hover:bg-black/40 lg:w-full"
                >
                  <div className="relative h-16 w-16 shrink-0">
                    <img src={entryThumb(e.work_url)} alt="" className="h-full w-full object-cover" />
                    <span className="absolute left-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-black/60 text-[10px] font-bold text-white">{i + 1}</span>
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col justify-center px-3 py-2">
                    <p className="truncate text-sm font-bold text-white">{e.title || e.creator_name}</p>
                    <p className="truncate text-[11px] text-white/60">{[e.creator_name, e.state].filter(Boolean).join(' · ')}</p>
                    <p className="mt-0.5 flex items-center gap-1 text-[11px] font-semibold text-white/80">
                      <Heart className="h-3 w-3" style={{ color: cat.color }} /> {e.vote_count || 0} votes
                    </p>
                  </div>
                </ChallengeLink>
              ))}
            </div>
          </div>
        )}
        </div>

        {challenges.length > 1 && (
          <div className="mt-8 flex items-center gap-2">
            {challenges.map((c, i) => (
              <button
                key={c.id}
                onClick={() => setCurrentIdx(i)}
                className={`h-2 rounded-full transition-all ${
                  i === currentIdx ? 'w-8 bg-white' : 'w-2 bg-white/40 hover:bg-white/60'
                }`}
                aria-label={`Switch to ${categoryMeta(c.category).name}`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}