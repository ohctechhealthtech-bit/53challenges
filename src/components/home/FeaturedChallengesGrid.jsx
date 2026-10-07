import { SkeletonGrid } from '@/components/motion/Skeleton';
import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Trophy, Users, Calendar } from 'lucide-react';
import { challengeApi } from '@/lib/challengeApi';
import { useCategories } from '@/hooks/useCategories';
import {
  normalizeCategory,
  isPublicChallenge,
  challengePhase,
  challengeTitle,
  categoryMeta,
  daysLeft,
  isOpenForEntries,
} from '@/lib/challenges-data';

const RED = '#ff3b3b';
const TEAL = '#00d1c1';
const GOLD = '#ffce54';
const FALLBACK_IMG =
  'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?auto=format&fit=crop&w=800&q=80';

/**
 * One recent challenge per parent category — picks the soonest-ending active
 * challenge from each category returned by the live Challenge API.
 * Each card shows its status badge, key info, and a phase-appropriate CTA.
 */
export default function FeaturedChallengesGrid() {
  const { categories, loading: catsLoading } = useCategories();
  const [all, setAll] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    challengeApi
      .listChallenges()
      .then((res) => {
        if (!mounted) return;
        setAll((res.challenges || []).filter(isPublicChallenge));
      })
      .catch(() => {})
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, []);

  const cards = useMemo(() => {
    if (!categories.length) return [];

    const byCategory = {};
    for (const c of all) {
      const slug = normalizeCategory(c.category);
      if (!byCategory[slug]) byCategory[slug] = [];
      byCategory[slug].push(c);
    }

    const picked = [];
    for (const cat of categories) {
      const candidates = (byCategory[cat.slug] || []).filter((c) => {
        const p = challengePhase(c);
        return p === 'submit' || p === 'vote' || p === 'upcoming';
      });
      if (!candidates.length) continue;

      candidates.sort((a, b) => {
        const pa = challengePhase(a);
        const pb = challengePhase(b);
        if (pa === 'submit' && pb !== 'submit') return -1;
        if (pb === 'submit' && pa !== 'submit') return 1;
        const da = daysLeft(a.submission_ends_at || a.end_date || a.voting_ends_at);
        const db = daysLeft(b.submission_ends_at || b.end_date || b.voting_ends_at);
        return da - db;
      });
      picked.push(candidates[0]);
    }

    picked.sort(
      (a, b) =>
        daysLeft(a.submission_ends_at || a.end_date || a.voting_ends_at) -
        daysLeft(b.submission_ends_at || b.end_date || b.voting_ends_at)
    );

    return picked.slice(0, 6);
  }, [all, categories]);

  if (loading || catsLoading) {
    // Card-shaped placeholders in the grid's own columns, not a lone spinner:
    // the section keeps its height and the cards land where the shapes are.
    // On a repeat visit the cache answers before first paint and this never
    // shows.
    return <SkeletonGrid count={6} />;
  }

  if (cards.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-slate-500">
        No featured challenges right now — check back soon.
      </div>
    );
  }

  const loop = cards.length > 1 ? [...cards, ...cards] : cards;

  return (
    <div className="marquee-pause relative w-full overflow-hidden">
      <div className="marquee-track flex w-max gap-5">
        {loop.map((c, idx) => {
          const phase = challengePhase(c);
          const cat = categoryMeta(c.category);
          const title = challengeTitle(c);

          const badge =
            phase === 'submit'
              ? 'OPEN FOR ENTRIES'
              : phase === 'vote'
              ? 'VOTING NOW'
              : 'COMING SOON';
          const badgeColor = phase === 'upcoming' ? GOLD : TEAL;

          const canEnter = isOpenForEntries(c);
          const cta =
            phase === 'vote'
              ? { label: 'Watch & Vote', to: `/challenges/${c.id}`, color: TEAL }
              : phase === 'upcoming'
              ? { label: 'Notify Me', to: `/challenges/${c.id}`, color: GOLD }
              : canEnter
              ? { label: 'Enter Now', to: `/challenges/${c.id}`, color: RED }
              : null;

          const cover = c.cover_image || FALLBACK_IMG;

          let info = '';
          let InfoIcon = Trophy;
          if (phase === 'vote') {
            info = `${(c.vote_count || 0).toLocaleString()} votes cast`;
            InfoIcon = Users;
          } else if (phase === 'upcoming') {
            const start = c.starts_at ? new Date(c.starts_at) : null;
            info = start
              ? `Starts ${start.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}`
              : 'Coming soon';
            InfoIcon = Calendar;
          } else {
            const left = daysLeft(c.submission_ends_at || c.end_date);
            info = left > 0 ? `Entries close in ${left} day${left === 1 ? '' : 's'}` : 'Closing soon';
          }

          return (
            <Link
              key={`${c.id}-${idx}`}
              to={cta ? cta.to : `/challenges/${c.id}`}
              className="card group w-[280px] shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-white transition-all duration-300 hover:-translate-y-1 hover:border-slate-300 hover:shadow-lg hover:shadow-slate-200/60 sm:w-[320px]"
            >
              <div className="relative h-40 overflow-hidden">
                <img
                  src={cover}
                  alt={title}
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <span
                  style={{ backgroundColor: badgeColor }}
                  className={`absolute right-3 top-3 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-white ${phase === 'submit' ? 'c53-badge-pulse' : ''}`}
                >
                  {badge}
                </span>
              </div>
              <div className="p-4">
                <p className="text-xs font-semibold text-slate-400">{cat.name}</p>
                <h3 className="mt-1 line-clamp-2 font-bold text-slate-900">{title}</h3>
                <div className="mt-2.5 flex items-center gap-1.5 text-xs text-slate-500">
                  <InfoIcon size={13} style={{ color: GOLD }} />
                  {info}
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                  <span className="text-xs text-slate-400">{cat.name}</span>
                  {cta && (
                    <span
                      className="flex items-center text-sm font-semibold"
                      style={{ color: cta.color }}
                    >
                      {cta.label} <ChevronRight size={14} />
                    </span>
                  )}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}