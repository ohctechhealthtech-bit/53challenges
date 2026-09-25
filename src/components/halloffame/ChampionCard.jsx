import { Link } from 'react-router-dom';
import { Trophy, ShieldCheck, MapPin, Crown } from 'lucide-react';
import { categoryMeta } from '@/lib/challenges-data';

// A single inducted champion. `featured` gives the leading champions a larger,
// gold-plated treatment; the rest use a calm engraved plaque.
export default function ChampionCard({ champion: w, position, featured = false }) {
  const cat = categoryMeta(w.challenge?.category);
  const score = w.combined_score != null
    ? `${w.combined_score.toFixed(2)} score`
    : `${(w.total_points || 0).toLocaleString()} pts`;

  return (
    <Link
      to={w.challenge?.id ? `/challenges/${w.challenge.id}` : '/leaderboard'}
      className={`card-lift group relative flex flex-col overflow-hidden rounded-3xl border bg-card transition ${
        featured
          ? 'border-amber-400/50 p-8 shadow-[0_20px_60px_-25px_rgba(244,183,64,0.45)] hover:border-amber-300'
          : 'border-border p-6 hover:border-amber-400/50'
      }`}
    >
      {featured && (
        <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-300 to-transparent" />
      )}
      <div
        className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full opacity-60 blur-2xl transition-opacity group-hover:opacity-100"
        style={{ background: featured ? 'rgba(244,183,64,0.28)' : 'rgba(244,183,64,0.12)' }}
      />

      <div className="flex items-start justify-between gap-4">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider ${
            featured
              ? 'bg-amber-500/20 text-amber-200'
              : 'bg-amber-500/10 text-amber-300/90'
          }`}
        >
          {w.series ? <Crown className="h-3.5 w-3.5" /> : <Trophy className="h-3.5 w-3.5" />}
          {w.series ? 'Series Champion' : 'Champion'}
        </span>
        {position != null && (
          <span
            className={`font-heading font-extrabold tabular-nums text-amber-400/40 ${
              featured ? 'text-4xl' : 'text-2xl'
            }`}
          >
            {String(position).padStart(2, '0')}
          </span>
        )}
      </div>

      <h3
        className={`mt-4 font-heading font-bold leading-snug ${
          featured ? 'text-2xl' : 'text-lg'
        }`}
      >
        {w.entry_title || w.creator_name || 'Untitled'}
      </h3>
      {w.creator_name && (
        <p className="mt-1 text-sm text-muted-foreground">{w.creator_name}</p>
      )}

      <p className={`mt-4 font-heading font-extrabold text-amber-300 ${featured ? 'text-xl' : 'text-base'}`}>
        {score}
      </p>

      <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-border pt-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="grid h-5 w-5 place-items-center rounded-full bg-amber-500/15 text-[10px]">{cat.icon}</span>
          {w.challenge?.theme || w.challenge?.title || cat.name}
        </span>
        {w.state && (
          <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {w.state}</span>
        )}
        <span className="flex items-center gap-1.5 text-emerald-400">
          <ShieldCheck className="h-3.5 w-3.5" /> Audited
        </span>
      </div>
    </Link>
  );
}