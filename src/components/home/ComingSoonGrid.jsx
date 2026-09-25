import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, ChevronRight, Bell } from 'lucide-react';
import { challengeApi } from '@/lib/challengeApi';
import {
  isPublicChallenge,
  challengePhase,
  challengeTitle,
  categoryMeta,
} from '@/lib/challenges-data';

const GOLD = '#d4af37';

/**
 * Grid of upcoming challenges whose submission window hasn't opened yet.
 * Clicking a card navigates to the challenge detail page.
 */
export default function ComingSoonGrid() {
  const [challenges, setChallenges] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    challengeApi
      .listChallenges()
      .then((res) => {
        if (!mounted) return;
        const upcoming = (res.challenges || [])
          .filter(isPublicChallenge)
          .filter((c) => challengePhase(c) === 'upcoming')
          .sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));
        setChallenges(upcoming);
      })
      .catch(() => {})
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, []);

  const cards = useMemo(
    () =>
      challenges.map((c) => {
        const cat = categoryMeta(c.category);
        const start = c.starts_at ? new Date(c.starts_at) : null;
        const meta = start
          ? `Starts ${start.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}`
          : 'Coming soon';
        return {
          id: c.id,
          title: challengeTitle(c),
          category: cat.name,
          accent: cat.color,
          meta,
          to: `/challenges/${c.id}`,
        };
      }),
    [challenges]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-slate-400">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-slate-500">
        No upcoming challenges right now — check back soon.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((c) => (
        <Link
          key={c.id}
          to={c.to}
          className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md"
        >
          <div className="relative h-32" style={{ backgroundColor: c.accent || GOLD }}>
            <span
              style={{ backgroundColor: GOLD }}
              className="absolute right-3 top-3 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-white"
            >
              Coming Soon
            </span>
          </div>
          <div className="p-4">
            <p className="text-xs font-semibold text-slate-400">{c.category}</p>
            <h3 className="mt-1 line-clamp-2 font-bold text-slate-900">{c.title}</h3>
            <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
              <span className="text-xs text-slate-500">{c.meta}</span>
              <span
                className="flex items-center text-sm font-semibold"
                style={{ color: GOLD }}
              >
                <Bell size={14} className="mr-1" /> Notify Me <ChevronRight size={14} />
              </span>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}