import { safeExternalUrl } from '@/lib/safeUrl';
import { useState } from 'react';
import { Heart, MapPin, ExternalLink, Loader2 } from 'lucide-react';
import { Image } from '@/components/ui/image';
import { challengeApi } from '@/lib/challengeApi';
import { useAuth } from '@/lib/AuthContext';
import { divisionBySlug } from '@/lib/challenges-data';

export default function EntryCard({ entry, rank, votedEntryIds, onVoted, initialCount }) {
  const { isAuthenticated, user, navigateToLogin } = useAuth();
  const [count, setCount] = useState(initialCount ?? entry.vote_count ?? 0);
  const [localVoted, setLocalVoted] = useState(false);
  const [busy, setBusy] = useState(false);
  const voted = localVoted || (votedEntryIds?.has?.(entry.id) ?? false);
  const division = divisionBySlug(entry.division);

  const onVoteClick = async () => {
    if (!isAuthenticated) { navigateToLogin(); return; }
    setBusy(true);
    try {
      const res = await challengeApi.castVoteLocal({
        entry_id: entry.id,
        challenge_id: entry.challenge_id,
        user_id: user?.id || user?.email || '',
        user_email: user?.email,
      });
      if (res?.success) {
        setCount(res.votes);
        setLocalVoted(true);
        onVoted?.(entry.id, res.votes);
      } else if (res?.duplicate) {
        setLocalVoted(true);
        setCount(res.votes ?? count);
      }
    } catch (e) {
      // silent
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card-lift group relative flex flex-col overflow-hidden rounded-3xl border border-border bg-card hover:border-primary/40">
      <div className="relative aspect-[4/3] overflow-hidden bg-muted">
        {entry.work_url ? (
          <Image src={entry.work_url} alt={entry.title} className="h-full w-full transition-transform duration-500 group-hover:scale-110" fittingType="fill" />
        ) : (
          <div className="absolute inset-0 grid place-items-center bg-gradient-to-br from-primary/15 via-muted to-secondary">
            <span className="text-5xl opacity-70">🎨</span>
          </div>
        )}
        {rank && (
          <span className="absolute left-3 top-3 grid h-8 w-8 place-items-center rounded-full bg-foreground text-sm font-bold text-background">{rank}</span>
        )}
        {division && (
          <span className="absolute right-3 top-3 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-foreground">{division.name}</span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-5">
        <h4 className="font-heading text-base font-bold leading-snug">{entry.title}</h4>
        {entry.description && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{entry.description}</p>}
        <div className="mt-auto flex items-center justify-between pt-4">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{entry.creator_name}</p>
            {(entry.city || entry.state) && (
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3" /> {entry.city || entry.state}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {safeExternalUrl(entry.work_url) && (
              <a href={safeExternalUrl(entry.work_url)} target="_blank" rel="noreferrer" className="grid h-9 w-9 place-items-center rounded-full bg-white/5 text-foreground hover:bg-muted" aria-label="View work">
                <ExternalLink className="h-4 w-4" />
              </a>
            )}
            <button
              onClick={onVoteClick}
              disabled={busy || voted}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold transition-all active:scale-95 disabled:cursor-default ${voted ? 'bg-rose-500 text-white' : 'bg-white/5 text-foreground hover:bg-rose-500/20'}`}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Heart className={`h-4 w-4 ${voted ? 'fill-current' : ''}`} />}
              {count}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}