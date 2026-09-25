import { Link } from 'react-router-dom';
import { Heart, Flame } from 'lucide-react';
import RevealOnScroll from '@/components/home/RevealOnScroll';

const MEDALS = ['🥇', '🥈', '🥉'];

// Live entry leaderboard — approved entries ranked by real community votes.
export default function LiveLeaderboard({ entries = [] }) {
  if (!entries.length) return null;
  const max = entries[0]?.community_votes || 1;

  return (
    <section className="mt-14">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-heading text-2xl font-bold">
          <Flame className="h-6 w-6 text-primary" /> Live leaderboard
        </h2>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" /> Updating live
        </span>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">Today's most-voted entries across every live challenge.</p>

      <RevealOnScroll className="mt-6 overflow-hidden rounded-2xl border border-border bg-card">
        <ol className="divide-y divide-border">
          {entries.map((e, i) => (
            <li key={e.id || i}>
              <Link
                to={`/challenges/${e.challenge_id}`}
                className="flex items-center gap-3 px-4 py-3 transition hover:bg-white/[0.03] sm:gap-4 sm:px-5"
              >
                <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-extrabold ${i < 3 ? 'bg-amber-500/15 text-lg' : 'bg-muted text-muted-foreground'}`}>
                  {i < 3 ? MEDALS[i] : i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{e.title || 'Untitled entry'}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {e.creator_name}
                    {e.state ? ` · ${e.state}` : ''}
                    {e.challenge_title ? ` · ${e.challenge_title}` : ''}
                  </p>
                </div>
                <div className="hidden h-2 w-32 shrink-0 overflow-hidden rounded-full bg-muted sm:block">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-700"
                    style={{ width: `${Math.max(4, ((e.community_votes || 0) / max) * 100)}%` }}
                  />
                </div>
                <span className="inline-flex shrink-0 items-center gap-1.5 font-heading text-sm font-extrabold text-primary">
                  <Heart className="h-4 w-4 fill-current" /> {(e.community_votes || 0).toLocaleString()}
                </span>
              </Link>
            </li>
          ))}
        </ol>
      </RevealOnScroll>
    </section>
  );
}