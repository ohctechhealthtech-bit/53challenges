import { useEffect, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Heart, Share2, MessageCircle, Trophy, Loader2, Play } from 'lucide-react';
import { challengeApi } from '@/lib/challengeApi';
import { useAuth } from '@/lib/AuthContext';
import { getSessionToken } from '@/lib/appSession';
import { divisionBySlug, categoryMeta } from '@/lib/challenges-data';
import { workKind } from './EntryWorkMedia';
import CommentSection from './CommentSection';
import VideoPreviewBlock from './VideoPreviewBlock';
import TextPreviewBlock from './TextPreviewBlock';
import { STATE_NAMES, CATEGORY_EMOJIS, highlightMatch } from './discoverConstants';
import { ConfettiBurst, VoteSuccessBadge } from '@/components/motion/VoteCelebration';
import { DURATION, EASE } from '@/lib/motion';

// One entry on the Discover & Vote page, in the main site's card design. The
// voting, comments and lightbox behaviour is this app's own and unchanged;
// what moved is the presentation around it.
export default function VoteCard({ entry, rank, challengeTheme, onOpen, index, finished, votedEntryIds, onVoted, initialCount, complianceBlocked, commentCount = 0, search = '', isActive = false }) {
  const { isAuthenticated, user, navigateToLogin, clearChallengeApiSession } = useAuth();
  const reduced = useReducedMotion();
  const [count, setCount] = useState(initialCount ?? entry.community_votes ?? entry.vote_count ?? 0);
  const [localVoted, setLocalVoted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [msgType, setMsgType] = useState(''); // 'error' | 'info' | 'success'
  const [heartPulse, setHeartPulse] = useState(false);
  const [shakeKey, setShakeKey] = useState(0);
  const [confettiTrigger, setConfettiTrigger] = useState(0);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [comments, setComments] = useState(commentCount);
  // Counts arrive async from the page-level fetch; keep in sync.
  useEffect(() => { setComments(commentCount); }, [commentCount]);
  const voted = localVoted || (votedEntryIds?.has?.(entry.id) ?? false);

  const division = divisionBySlug(entry.division);
  const cat = categoryMeta(entry.category);
  const { kind, url } = workKind(entry);
  // The listing can hand back the literal string "null" for a missing
  // thumbnail, so only a real URL counts as one.
  const thumb = /^https?:/.test(entry.thumbnail_url || '') ? entry.thumbnail_url : '';
  const hasImage = kind === 'image' ? (thumb || url) : thumb;
  const isVideoLike = kind === 'video' || kind === 'embed' || kind === 'audio';
  const onView = () => onOpen?.(index);
  const emoji = CATEGORY_EMOJIS[entry.category] || cat.icon || '✨';

  const onVoteClick = async () => {
    // Voting requires a signed-in account: either a platform session or the
    // signed token from the challenge login portal.
    if (!isAuthenticated && !getSessionToken()) {
      navigateToLogin();
      return;
    }
    setBusy(true);
    setMsg('');
    setMsgType('');
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
        setHeartPulse(true);
        setConfettiTrigger(Date.now());
        setMsgType('success');
        setTimeout(() => setHeartPulse(false), 600);
        onVoted?.(entry.id, res.votes);
      } else if (res?.duplicate) {
        setLocalVoted(true);
        setCount(res.votes ?? count);
        setMsg(res.error || 'You already voted for this entry.');
        setMsgType('info');
      } else if (/signed in|sign in|unauthor/i.test(res?.error || '')) {
        // The sign-in has lapsed server-side: send them back to log in
        // instead of showing a confusing "you must be signed in".
        clearChallengeApiSession?.();
        setMsg('Your sign-in has expired. Taking you to the login page…');
        setMsgType('error');
        setTimeout(navigateToLogin, 1500);
      } else {
        setMsg(res?.error || 'Vote could not be registered.');
        setMsgType('error');
        setShakeKey((k) => k + 1);
      }
    } catch (e) {
      setMsg(e?.message || 'Something went wrong.');
      setMsgType('error');
      setShakeKey((k) => k + 1);
    } finally {
      setBusy(false);
    }
  };

  const share = async () => {
    const shareUrl = window.location.origin + '/challenges/' + (entry.challenge_id || '') + '?entry=' + entry.id;
    try {
      if (navigator.share) await navigator.share({ title: entry.title, url: shareUrl });
      else await navigator.clipboard.writeText(shareUrl);
    } catch { /* cancelled or unsupported */ }
  };

  const errorMsg = msgType === 'error' ? msg : '';
  const border = voted ? 'border-orange-300 ring-1 ring-orange-200' : isActive ? 'border-amber-200' : 'border-stone-200';

  return (
    <motion.article
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={reduced ? undefined : { y: -3 }}
      transition={{ duration: 0.25 }}
      className={'overflow-hidden rounded-2xl border bg-white text-stone-900 shadow-sm transition-shadow hover:shadow-lg ' + border}
    >
      <ConfettiBurst trigger={confettiTrigger} />
      <div className="p-5 sm:p-6">
        {challengeTheme && (
          <span className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
            <Trophy className="h-3.5 w-3.5" /> {highlightMatch(challengeTheme, search)}
          </span>
        )}

        <div className="flex items-start gap-3">
          <span className="mt-0.5 text-2xl leading-none">{emoji}</span>
          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-bold leading-snug text-stone-900">{highlightMatch(entry.title, search)}</h3>
            <p className="mt-0.5 text-base text-stone-600">
              by <span className="font-medium text-stone-800">{highlightMatch(entry.creator_name, search)}</span>
            </p>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {entry.state && (
            <span className="rounded-full border border-teal-100 bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-800">
              {highlightMatch(STATE_NAMES[entry.state] || entry.state, search)}
            </span>
          )}
          <span className="rounded-full border border-orange-100 bg-orange-50 px-2.5 py-1 text-xs font-semibold text-orange-800">
            {highlightMatch(cat.name, search)}
          </span>
          {division && (
            <span className="rounded-full border border-yellow-200 bg-yellow-50 px-2.5 py-1 text-xs font-semibold text-yellow-800">
              {division.name}
            </span>
          )}
        </div>

        {hasImage ? (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onView(); }}
            aria-label={'View content: ' + (entry.title || 'entry')}
            className="group relative mt-4 block w-full cursor-pointer overflow-hidden rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
          >
            <img
              src={hasImage}
              alt={entry.title || ''}
              loading="lazy"
              draggable="false"
              className="h-48 w-full select-none object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            />
            <span className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/25">
              <span className="flex h-12 w-12 scale-90 items-center justify-center rounded-full bg-white/90 text-teal-700 opacity-0 shadow-lg transition-all group-hover:scale-100 group-hover:opacity-100">
                <Play className="ml-0.5 h-5 w-5" />
              </span>
            </span>
          </button>
        ) : isVideoLike ? (
          <VideoPreviewBlock entry={entry} onView={onView} />
        ) : (
          <TextPreviewBlock entry={entry} onView={onView} />
        )}

        {entry.description && (hasImage || isVideoLike) && (
          <p className="mt-3 line-clamp-2 text-base text-stone-600">{highlightMatch(entry.description, search)}</p>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-stone-100 pt-4 sm:gap-3">
          <div className="mr-auto flex flex-wrap items-baseline gap-1.5">
            {finished && (
              <>
                <motion.span
                  key={count}
                  initial={{ scale: 1.35, color: '#ea580c' }}
                  animate={{ scale: 1, color: '#c2410c' }}
                  transition={{ type: 'spring', stiffness: 300, damping: 18 }}
                  className="text-2xl font-extrabold"
                >
                  {count}
                </motion.span>
                <span className="text-sm font-medium text-stone-500">{count === 1 ? 'vote' : 'votes'}</span>
                {rank && (
                  <span className="ml-1 rounded-full border border-amber-200 bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800">
                    Rank #{rank}
                  </span>
                )}
                <span className="mx-1 text-stone-300">&middot;</span>
              </>
            )}
            <button
              type="button"
              onClick={() => setCommentsOpen((o) => !o)}
              aria-expanded={commentsOpen}
              aria-label={comments + (comments === 1 ? ' comment' : ' comments') + (commentsOpen ? ' (hide)' : ' (show)')}
              className={'inline-flex items-center gap-1 text-sm font-medium underline-offset-2 hover:underline ' + (commentsOpen ? 'text-teal-900' : 'text-teal-700 hover:text-teal-900')}
            >
              <MessageCircle className="h-4 w-4" />
              {comments} {comments === 1 ? 'comment' : 'comments'}
            </button>
          </div>

          {complianceBlocked ? (
            <span className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-amber-100 px-5 text-base font-bold text-amber-700">
              <Heart className="h-5 w-5" /> Voting paused
            </span>
          ) : (
            <motion.div
              key={'vote-btn-' + shakeKey}
              animate={errorMsg && !reduced ? { x: [0, -6, 6, -4, 4, 0] } : { x: 0 }}
              transition={errorMsg && !reduced ? { duration: 0.4 } : { duration: 0 }}
              className="relative"
            >
              <VoteSuccessBadge show={localVoted && msgType === 'success'} />
              <button
                type="button"
                onClick={onVoteClick}
                disabled={busy || voted}
                aria-live="polite"
                className={'inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full px-5 text-base font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 ' + (voted
                  ? 'cursor-default bg-orange-100 text-orange-700'
                  : 'bg-orange-500 text-white shadow-md shadow-orange-500/25 hover:bg-orange-600 hover:shadow-lg active:scale-[0.98]')}
              >
                {busy ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <span className="relative">
                    <Heart className={'h-5 w-5 ' + (voted ? 'fill-current ' : '') + (heartPulse ? 'heart-pop' : '')} />
                    <AnimatePresence>
                      {heartPulse && (
                        <motion.span
                          initial={{ scale: 0.5, opacity: 0.6 }}
                          animate={{ scale: 2.5, opacity: 0 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.6, ease: 'easeOut' }}
                          className="pointer-events-none absolute inset-0 rounded-full bg-white/40"
                        />
                      )}
                    </AnimatePresence>
                  </span>
                )}
                {voted ? 'Voted' : busy ? 'Voting…' : 'Vote'}
              </button>
            </motion.div>
          )}

          <button
            type="button"
            onClick={share}
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full border border-stone-200 bg-white px-4 text-base font-semibold text-stone-700 transition-all hover:border-teal-300 hover:bg-teal-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
          >
            <Share2 className="h-4 w-4" /> Share
          </button>
        </div>

        <AnimatePresence>
          {msg && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: DURATION.fast, ease: EASE.out }}
              className={'mt-2 text-xs font-medium ' + (msgType === 'error' ? 'text-red-600' : msgType === 'success' ? 'text-emerald-600' : 'text-orange-700')}
              role={msgType === 'error' ? 'alert' : 'status'}
            >
              {msgType === 'success' ? 'Vote confirmed!' : msg}
            </motion.p>
          )}
        </AnimatePresence>

        {commentsOpen && (
          <CommentSection entryId={entry.id} challengeId={entry.challenge_id} onCountChange={setComments} />
        )}
      </div>
    </motion.article>
  );
}
