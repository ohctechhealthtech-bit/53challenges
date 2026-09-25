import { useEffect, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Heart, MapPin, Share2, MessageCircle, Palette, Trophy, Loader2 } from 'lucide-react';
import { challengeApi } from '@/lib/challengeApi';
import { useAuth } from '@/lib/AuthContext';
import { getSessionToken } from '@/lib/appSession';
import { divisionBySlug, categoryMeta } from '@/lib/challenges-data';
import EntryWorkMedia, { workKind } from './EntryWorkMedia';
import CommentSection from './CommentSection';
import { ConfettiBurst, VoteSuccessBadge } from '@/components/motion/VoteCelebration';
import { DURATION, EASE, VARIANTS, VIEWPORT } from '@/lib/motion';

export default function VoteCard({ entry, rank, challengeTheme, onOpen, index, finished, votedEntryIds, onVoted, initialCount, complianceBlocked, commentCount = 0 }) {
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
  // Counts arrive async from the page-level fetch — keep in sync.
  useEffect(() => { setComments(commentCount); }, [commentCount]);
  const voted = localVoted || (votedEntryIds?.has?.(entry.id) ?? false);

  const division = divisionBySlug(entry.division);
  const cat = categoryMeta(entry.category);
  const { kind } = workKind(entry);
  // Videos and embedded players keep their own controls, so the frame isn't a
  // lightbox button for them.
  const playable = kind === 'video' || kind === 'embed' || kind === 'audio';

  const onVoteClick = async () => {
    // Voting requires a signed-in account — either a platform session or the
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
        // The sign-in has lapsed server-side — send them back to log in
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
    const url = window.location.origin + '/challenges/' + (entry.challenge_id || '') + '?entry=' + entry.id;
    try {
      if (navigator.share) await navigator.share({ title: entry.title, url });
      else await navigator.clipboard.writeText(url);
    } catch {}
  };

  const chainVariants = {
    hidden: { opacity: 0, x: -24 },
    visible: (i) => ({
      opacity: 1,
      x: 0,
      transition: { duration: DURATION.section, ease: EASE.out, delay: (index || 0) * 0.08 + i * 0.12 },
    }),
  };

  const errorMsg = msgType === 'error' ? msg : '';

  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={VIEWPORT}
      variants={reduced ? { hidden: { opacity: 0 }, visible: { opacity: 1 } } : VARIANTS.fadeUp}
      className="overflow-hidden rounded-2xl border border-[#FBCAB5] bg-white text-[#1A1A1A] shadow-sm transition-shadow duration-300 hover:shadow-xl"
    >
      <ConfettiBurst trigger={confettiTrigger} />

      {/* Header */}
      <motion.div custom={0} variants={chainVariants} className="px-5 pt-4">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FFE7D6] px-3 py-1 text-xs font-semibold text-[#E86A33]">
          <Trophy className="h-3.5 w-3.5" /> {challengeTheme || '53 Challenge'}
        </span>
        <h3 className="mt-3 font-heading text-xl font-bold leading-tight">{entry.title}</h3>
        <p className="mt-1.5 flex items-center gap-1.5 text-sm text-[#6b6b6b]">
          <Palette className="h-3.5 w-3.5 text-[#E86A33]" /> by {entry.creator_name}
        </p>
        <div className="mt-2.5 flex flex-wrap gap-2">
          {entry.state && (
            <span className="rounded-full bg-[#D5F5E3] px-3 py-1 text-xs font-semibold text-[#1e6b3a]">{entry.state}</span>
          )}
          <span className="rounded-full bg-[#D6EAF8] px-3 py-1 text-xs font-semibold text-[#1a4d7a]">{cat.name}</span>
          {division && (
            <span className="rounded-full bg-[#FCF3CF] px-3 py-1 text-xs font-semibold text-[#8a6d1b]">{division.name}</span>
          )}
        </div>
      </motion.div>

      {/* Image */}
      <motion.div
        custom={1}
        variants={chainVariants}
        className="mt-4 block w-full px-5"
        {...(playable ? {} : { role: 'button', tabIndex: 0, onClick: () => onOpen?.(index), onKeyDown: (e) => { if (e.key === 'Enter' || e.key === ' ') onOpen?.(index); }, 'aria-label': 'Open full view' })}
      >
        <div className="group/img relative aspect-[4/3] w-full overflow-hidden rounded-xl bg-[#f3f3f3]">
          <EntryWorkMedia entry={entry} />
          {rank && finished && (
            <span className="absolute left-3 top-3 grid h-8 w-8 place-items-center rounded-full bg-[#E86A33] text-sm font-bold text-white">{rank}</span>
          )}
          <span className="light-sweep" />
        </div>
      </motion.div>

      {/* Caption — hidden for text entries, since the frame already shows it */}
      {entry.description && kind !== 'text' && (
        <motion.p custom={2} variants={chainVariants} className="px-5 pt-3 text-sm leading-relaxed text-[#3a3a3a]">{entry.description}</motion.p>
      )}

      {/* Footer */}
      <motion.div custom={3} variants={chainVariants} className="px-5 pb-4 pt-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-4 text-sm">
            {finished && (
              <span className="flex items-center gap-1.5 font-bold text-[#E67E22]">
                <Heart className="h-4 w-4 fill-current" /> {count} vote{count === 1 ? '' : 's'}
              </span>
            )}
            <button
              onClick={() => setCommentsOpen((o) => !o)}
              className={`flex items-center gap-1.5 rounded-full px-2 py-1 transition hover:bg-[#FFE7D6] ${commentsOpen ? 'bg-[#FFE7D6] text-[#E86A33]' : 'text-[#1A1A1A]'}`}
              aria-expanded={commentsOpen}
              aria-label={`${comments} comment${comments === 1 ? '' : 's'} — ${commentsOpen ? 'hide' : 'show'} comments`}
            >
              <MessageCircle className="h-4 w-4" /> {comments}
            </button>
          </div>
          <div className="flex items-center gap-2">
            {complianceBlocked ? (
              <span className="flex items-center gap-1.5 rounded-full bg-amber-100 px-4 py-2 text-sm font-bold text-amber-700">
                <Heart className="h-4 w-4" /> Voting paused
              </span>
            ) : (
            <motion.div
              key={`vote-btn-${shakeKey}`}
              animate={errorMsg && !reduced ? { x: [0, -6, 6, -4, 4, 0] } : { x: 0 }}
              transition={errorMsg && !reduced ? { duration: 0.4 } : { duration: 0 }}
              className="relative"
            >
              <VoteSuccessBadge show={localVoted && msgType === 'success'} />
              <button
                onClick={onVoteClick}
                disabled={busy || voted}
                aria-live="polite"
                className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold transition-all active:scale-95 disabled:cursor-default ${voted ? 'bg-[#E67E22] text-white' : 'bg-[#E67E22] text-white hover:brightness-110'}`}
              >
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <span className="relative">
                    <Heart className={`h-4 w-4 ${voted ? 'fill-current' : ''} ${heartPulse ? 'heart-pop' : ''}`} />
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
              onClick={share}
              className="group flex items-center gap-1.5 rounded-full border border-[#FBCAB5] bg-white px-4 py-2 text-sm font-bold text-[#1A1A1A] transition hover:bg-[#FFF7F0]"
            >
              <Share2 className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" /> Share
            </button>
          </div>
        </div>
        <AnimatePresence>
          {msg && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: DURATION.fast, ease: EASE.out }}
              className={`mt-2 text-xs font-medium ${msgType === 'error' ? 'text-red-600' : msgType === 'success' ? 'text-emerald-600' : 'text-[#E86A33]'}`}
              role={msgType === 'error' ? 'alert' : 'status'}
            >
              {msgType === 'success' ? 'Vote confirmed!' : msg}
            </motion.p>
          )}
        </AnimatePresence>
        {commentsOpen && (
          <CommentSection
            entryId={entry.id}
            challengeId={entry.challenge_id}
            onCountChange={setComments}
          />
        )}
      </motion.div>
    </motion.div>
  );
}