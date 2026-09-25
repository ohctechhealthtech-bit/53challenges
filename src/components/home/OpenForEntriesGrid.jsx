import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, ChevronRight } from 'lucide-react';
import { challengeApi } from '@/lib/challengeApi';
import {
  isPublicChallenge,
  challengePhase,
  challengeStatus,
  challengeTitle,
  daysLeft,
  categoryMeta,
} from '@/lib/challenges-data';

const TEAL = '#00a8a8';
const RED = '#F04E37';

/**
 * Grid of challenges currently open for entries (submission phase live).
 * Clicking a card opens the challenge detail page where people can participate.
 */
export default function OpenForEntriesGrid() {
  const [challenges, setChallenges] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    challengeApi
      .listChallenges()
      .then((res) => {
        if (!mounted) return;
        const open = (res.challenges || [])
          .filter(isPublicChallenge)
          .filter((c) => challengePhase(c) === 'submit');
        setChallenges(open);
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
        const status = challengeStatus(c);
        const cat = categoryMeta(c.category);
        const left = daysLeft(c.submission_ends_at || c.end_date);
        return {
          id: c.id,
          title: challengeTitle(c),
          category: cat.name,
          accent: cat.color,
          meta: left > 0 ? `${left} day${left === 1 ? '' : 's'} left` : 'Closing soon',
          to: `/challenges/${c.id}`,
          status,
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
        No challenges are open for entries right now — check back soon.
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
          <div className="relative h-32" style={{ backgroundColor: c.accent || TEAL }}>
            <span
              style={{ backgroundColor: TEAL }}
              className="absolute right-3 top-3 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-white"
            >
              {c.status.label}
            </span>
          </div>
          <div className="p-4">
            <p className="text-xs font-semibold text-slate-400">{c.category}</p>
            <h3 className="mt-1 font-bold text-slate-900 line-clamp-2">{c.title}</h3>
            <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
              <span className="text-xs text-slate-500">{c.meta}</span>
              <span
                className="flex items-center text-sm font-semibold"
                style={{ color: RED }}
              >
                Enter Now <ChevronRight size={14} />
              </span>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}