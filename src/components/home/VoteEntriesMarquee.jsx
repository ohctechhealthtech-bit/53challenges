import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trophy, Loader2 } from 'lucide-react';
import { challengeApi } from '@/lib/challengeApi';
import { categoryMeta } from '@/lib/challenges-data';

function isImageUrl(url) {
  return /\.(png|jpe?g|webp|gif|avif)(\?|$)/i.test(url || '');
}

/**
 * Horizontal auto-scrolling marquee of the latest approved entries across all
 * running challenges. Clicking a card opens the entry detail on /challenges.
 */
export default function VoteEntriesMarquee({ limit = 24 }) {
  const navigate = useNavigate();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    challengeApi
      .latestEntries(limit)
      .then((res) => {
        if (!mounted) return;
        const list = (res?.entries || []).filter((e) => e && e.id);
        setEntries(list);
      })
      .catch(() => {})
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, [limit]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-slate-400">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (entries.length === 0) return null;

  const loop = [...entries, ...entries];
  const openEntry = (id, challengeId) =>
    navigate(`/challenges/${challengeId || ''}?entry=${id}`);

  return (
    <div className="relative overflow-hidden">
      <div className="vote-marquee-track flex w-max items-start py-1">
        {loop.map((sub, i) => {
          const cat = categoryMeta(sub.category);
          const image =
            sub.media_type === 'image'
              ? sub.thumbnail_url || sub.work_url
              : sub.thumbnail_url;
          const hasImage = isImageUrl(image);
          return (
            <div
              key={`${sub.id}-${i}`}
              onClick={() => openEntry(sub.id, sub.challenge_id)}
              role="link"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter') openEntry(sub.id, sub.challenge_id);
              }}
              className="group mr-4 w-60 shrink-0 cursor-pointer overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm transition-all hover:border-amber-300 hover:shadow-lg sm:mr-5 sm:w-72"
            >
              <div className="p-3 sm:p-4">
                {sub.challenge_title && (
                  <span className="mb-2 inline-flex max-w-full items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
                    <Trophy className="h-3 w-3 shrink-0" />
                    <span className="truncate">{sub.challenge_title}</span>
                  </span>
                )}

                <div className="flex items-start gap-2">
                  <span className="mt-0.5 text-xl leading-none">{cat.icon || '✨'}</span>
                  <div className="min-w-0">
                    <h3 className="truncate font-bold leading-snug text-stone-900">
                      {sub.title}
                    </h3>
                    <p className="truncate text-sm text-stone-600">
                      by{' '}
                      <span className="font-medium text-stone-800">
                        {sub.creator_name || sub.user_name || 'Anonymous'}
                      </span>
                    </p>
                  </div>
                </div>

                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {sub.state && (
                    <span className="rounded-full border border-teal-100 bg-teal-50 px-2 py-0.5 text-xs font-semibold text-teal-800">
                      {sub.state}
                    </span>
                  )}
                  <span className="rounded-full border border-orange-100 bg-orange-50 px-2 py-0.5 text-xs font-semibold text-orange-800">
                    {cat.name}
                  </span>
                  {sub.division_name && (
                    <span className="rounded-full border border-yellow-200 bg-yellow-50 px-2 py-0.5 text-xs font-semibold text-yellow-800">
                      {sub.division_name}
                    </span>
                  )}
                </div>

                {hasImage ? (
                  <div className="mt-3 overflow-hidden rounded-xl">
                    <img
                      src={image}
                      alt={sub.title}
                      loading="lazy"
                      className="h-28 w-full object-cover transition-transform duration-300 group-hover:scale-[1.03] sm:h-36"
                    />
                  </div>
                ) : (
                  sub.description && (
                    <p className="mt-3 line-clamp-4 rounded-xl bg-stone-50 p-3 text-sm leading-relaxed text-stone-600">
                      {sub.description}
                    </p>
                  )
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}