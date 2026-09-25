import { useEffect, useState } from 'react';
import { X, Heart, MessageCircle, Share2, Trophy, Loader2 } from 'lucide-react';
import SwipeStage from './SwipeStage';
import { Image } from '@/components/ui/image';
import { challengeApi } from '@/lib/challengeApi';
import { useAuth } from '@/lib/AuthContext';
import { divisionBySlug, categoryMeta } from '@/lib/challenges-data';
import WrittenEntryCard from './WrittenEntryCard';
import EntryWorkMedia, { workKind } from './EntryWorkMedia';

export default function EntryLightbox({ participants, p, c, onClose, onNavigate, finished, votedEntryIds, onVoted, voteCounts }) {
  const { isAuthenticated, user, navigateToLogin } = useAuth();
  const participant = participants[p];
  const entry = participant?.items?.[c];
  const initialCount = voteCounts?.[entry?.id] ?? entry?.community_votes ?? entry?.vote_count ?? 0;
  const [count, setCount] = useState(initialCount);
  const [localVoted, setLocalVoted] = useState(false);
  const [busy, setBusy] = useState(false);

  const voted = localVoted || (votedEntryIds?.has?.(entry?.id) ?? false);

  useEffect(() => {
    setCount(voteCounts?.[entry?.id] ?? entry?.community_votes ?? entry?.vote_count ?? 0);
    setLocalVoted(false);
  }, [entry?.id, voteCounts]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowDown') { if (p < participants.length - 1) onNavigate(p + 1, 0); }
      else if (e.key === 'ArrowUp') { if (p > 0) onNavigate(p - 1, 0); }
      else if (e.key === 'ArrowRight') { if (participant && c < participant.items.length - 1) onNavigate(p, c + 1); }
      else if (e.key === 'ArrowLeft') { if (participant && c > 0) onNavigate(p, c - 1); }
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [p, c, participants.length, participant]);

  if (!entry) return null;
  const division = divisionBySlug(entry.division);
  const media = workKind(entry);
  const challengeTheme = entry.challenge_title || '53 Challenge';
  const totalContent = participant.items.length;

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
      // silent — overlay vote control
    } finally {
      setBusy(false);
    }
  };

  const share = async () => {
    const url = window.location.origin + '/challenges/' + (entry.challenge_id || '') + '?entry=' + entry.id;
    try {
      if (navigator.share) await navigator.share({ title: entry.title, url });
      else await navigator.clipboard.writeText(url);
    } catch {}
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black">
      {/* Close */}
      <button onClick={onClose} className="absolute right-5 top-5 z-30 grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20" aria-label="Close">
        <X className="h-5 w-5" />
      </button>

      {/* Top centered meta */}
      <div className="absolute left-1/2 top-5 z-20 -translate-x-1/2 text-center">
        <p className="flex items-center justify-center gap-1.5 text-sm font-semibold text-white/90">
          <Trophy className="h-4 w-4 text-[#FF8A3D]" /> {challengeTheme}
        </p>
        <p className="mt-0.5 text-xs text-white/50">{p + 1} / {participants.length}</p>
      </div>

      {/* Swipeable stage — up/down between participants, left/right through content */}
      <div className="relative w-full max-w-3xl px-4">
        <SwipeStage
          key={`${p}-${c}`}
          canUp={p > 0}
          canDown={p < participants.length - 1}
          canLeft={totalContent > 1 && c > 0}
          canRight={totalContent > 1 && c < totalContent - 1}
          onUp={() => onNavigate(p - 1, 0)}
          onDown={() => onNavigate(p + 1, 0)}
          onLeft={() => onNavigate(p, c - 1)}
          onRight={() => onNavigate(p, c + 1)}
          className="mx-auto cursor-grab overflow-hidden rounded-xl active:cursor-grabbing"
        >
          {media.kind === 'image' ? (
            <Image src={media.url} alt={entry.title} className="max-h-[72vh] w-full object-contain" fittingType="fit" />
          ) : media.kind === 'text' ? (
            <WrittenEntryCard entry={entry} className="h-[60vh] w-full" />
          ) : (
            <div className="relative h-[72vh] w-full bg-black">
              <EntryWorkMedia entry={entry} />
            </div>
          )}
        </SwipeStage>

        {/* Content carousel dots */}
        {totalContent > 1 && (
          <div className="mt-3 flex items-center justify-center gap-1.5">
            {participant.items.map((_, i) => (
              <span key={i} className={`h-1.5 rounded-full transition-all ${i === c ? 'w-5 bg-white' : 'w-1.5 bg-white/40'}`} />
            ))}
          </div>
        )}

        <p className="mt-3 text-center text-xs text-white/40">
          Swipe up or down for the next creator{totalContent > 1 ? ' · swipe left or right through their work' : ''}
        </p>
      </div>

      {/* Bottom-left overlay */}
      <div className="absolute bottom-6 left-6 z-10 max-w-xl pr-32">
        <div className="mb-3 flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#E86A33] px-3 py-1 text-xs font-semibold text-white">
            <Trophy className="h-3.5 w-3.5" /> {challengeTheme}
          </span>
          {division && (
            <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white">{division.name}</span>
          )}
        </div>
        <h2 className="font-heading text-2xl font-bold text-white">{entry.title}</h2>
        <p className="mt-1 text-sm text-white/80">by {entry.creator_name}{entry.state ? ` · ${entry.state}` : ''}</p>
        {entry.description && <p className="mt-2 text-sm text-white/70">{entry.description}</p>}
      </div>

      {/* Right action rail */}
      <div className="absolute bottom-6 right-6 z-20 flex flex-col items-center gap-3">
        <button onClick={onVoteClick} disabled={busy || voted} className="grid h-12 w-12 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20 disabled:cursor-default" aria-label="Vote">
          {busy ? <Loader2 className="h-6 w-6 animate-spin" /> : <Heart className={`h-6 w-6 ${voted ? 'fill-[#FF8A3D] text-[#FF8A3D]' : 'text-white'}`} />}
        </button>
        {finished && <span className="text-xs font-semibold text-white">{count}</span>}
        <button className="grid h-12 w-12 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20" aria-label="Comment">
          <MessageCircle className="h-6 w-6" />
        </button>
        <button onClick={share} className="grid h-12 w-12 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20" aria-label="Share">
          <Share2 className="h-6 w-6" />
        </button>
      </div>
    </div>
  );
}