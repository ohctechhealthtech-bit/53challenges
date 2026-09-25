import { Link } from 'react-router-dom';
import { CalendarClock, Video, DollarSign, MapPin, ArrowRight, Play, Bell } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { Image } from '@/components/ui/image';
import {
  categoryMeta,
  challengeStatus,
  challengeTitle,
  challengeDescription,
  daysLeft,
} from '@/lib/challenges-data';
import { DURATION, EASE } from '@/lib/motion';

/**
 * Full-width hero matching the new design: dark background with a montage of
 * real challenge cover images, dark gradient overlay, left-aligned content
 * (badge, headline, subheadline, meta, CTAs). Falls back to a gradient if
 * no challenge images are available.
 */
export default function NewHomeHero({ challenge, challenges = [], loading }) {
  const reduced = useReducedMotion();
  const status = challenge ? challengeStatus(challenge) : null;
  const isNational = challenge && (challenge.geography || '').toLowerCase() === 'national';

  const deadline = challenge
    ? (status?.phase === 'vote' ? challenge.voting_ends_at : challenge.submission_ends_at)
    : null;
  const deadlineLabel = deadline
    ? new Date(deadline).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })
    : null;

  const prize = challenge?.prize_pool || '';
  const evidence = challenge?.evidence || 'Video entry';
  const challengeLink = challenge ? `/challenges/${challenge.id}` : '/challenges';
  // Land on the challenge intro page first, where the visitor picks Participate or Vote.
  const submitLink = challengeLink;
  const title = challenge ? challengeTitle(challenge) : 'Australian Dance Challenge';
  const desc =
    challenge && challengeDescription(challenge)
      ? challengeDescription(challenge)
      : "Australia\u2019s national creative challenge. Submit your original work, rally your community to vote, and represent your state on the national stage.";

  // Collect images for the background montage
  const montageImgs = challenges.filter((c) => c.cover_image).slice(0, 4).map((c) => c.cover_image);
  if (challenge?.cover_image && !montageImgs.includes(challenge.cover_image)) {
    montageImgs.unshift(challenge.cover_image);
  }

  const d = (n) => (reduced ? 0 : n);

  return (
    <section className="relative min-h-[560px] overflow-hidden lg:min-h-[640px]">
      {/* Background montage */}
      <div className="absolute inset-0">
        {montageImgs.length >= 3 ? (
          <div className="grid h-full w-full grid-cols-2 grid-rows-2">
            {montageImgs.slice(0, 4).map((src, i) => (
              <div key={i} className="relative overflow-hidden">
                <Image src={src} alt="" className="h-full w-full" fittingType="fill" />
              </div>
            ))}
          </div>
        ) : montageImgs.length > 0 ? (
          <Image src={montageImgs[0]} alt="" className="h-full w-full" fittingType="fill" />
        ) : (
          <div className="h-full w-full grad-soft-bg" />
        )}
        {/* Dark gradient overlay for text legibility */}
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/85 to-background/40" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-background/60" />
      </div>

      {/* Content */}
      <div className="container-tight relative flex min-h-[560px] flex-col justify-center py-16 lg:min-h-[640px] lg:py-24">
        <div className="max-w-xl">
          <motion.span
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: reduced ? 0.15 : DURATION.base, ease: EASE.out, delay: d(0.05) }}
            className="inline-flex items-center gap-2 rounded-full border border-gold/60 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.18em] text-gold"
          >
            Featured National Challenge
          </motion.span>

          <motion.h1
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: reduced ? 0.15 : DURATION.section, ease: EASE.out, delay: d(0.12) }}
            className="mt-5 font-heading text-4xl font-extrabold leading-tight tracking-tight text-balance sm:text-5xl lg:text-6xl"
          >
            {title}
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: reduced ? 0.15 : DURATION.base, ease: EASE.out, delay: d(0.20) }}
            className="mt-3 font-heading text-xl font-bold text-primary sm:text-2xl"
          >
            Your movement. Your stage. Your state.
          </motion.p>

          <motion.p
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: reduced ? 0.15 : DURATION.base, ease: EASE.out, delay: d(0.26) }}
            className="mt-4 max-w-lg text-base text-muted-foreground sm:text-lg"
          >
            {desc}
          </motion.p>

          {/* Meta line */}
          {challenge && status && (
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: reduced ? 0.15 : DURATION.base, ease: EASE.out, delay: d(0.32) }}
              className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm font-semibold text-foreground/90"
            >
              {deadlineLabel && (
                <span className="inline-flex items-center gap-1.5">
                  <CalendarClock className="h-4 w-4 text-primary" />
                  {status.phase === 'vote' ? 'Voting closes' : 'Entries close'} {deadlineLabel}
                </span>
              )}
              <span className="inline-flex items-center gap-1.5">
                <Video className="h-4 w-4 text-primary" />
                {evidence}
              </span>
              {prize && (
                <span className="inline-flex items-center gap-1.5">
                  <DollarSign className="h-4 w-4 text-gold" />
                  <span className="text-gold">{prize} prize pool</span>
                </span>
              )}
              {isNational && (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="h-4 w-4 text-primary" />
                  National
                </span>
              )}
            </motion.div>
          )}

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: reduced ? 0.15 : DURATION.base, ease: EASE.out, delay: d(0.38) }}
            className="mt-8 flex flex-wrap items-center gap-3"
          >
            <Link
              to={status?.phase === 'submit' ? submitLink : challengeLink}
              className="btn-bounce btn-glow group inline-flex items-center gap-2 rounded-xl bg-primary px-7 py-4 text-base font-bold text-primary-foreground shadow-lg shadow-primary/30 transition hover:-translate-y-0.5 hover:brightness-110"
            >
              Enter Challenge
              <ArrowRight className="h-5 w-5 transition-transform duration-200 group-hover:translate-x-1" />
            </Link>
            <Link
              to="/challenges?phase=vote"
              className="group inline-flex items-center gap-2 rounded-xl border-2 px-6 py-4 text-base font-bold text-white backdrop-blur-sm transition hover:bg-white/10"
              style={{ borderColor: '#00a8a8' }}
            >
              <Play className="h-5 w-5" style={{ color: '#00a8a8' }} /> Watch &amp; Vote
            </Link>
            <Link
              to={challengeLink}
              className="inline-flex items-center gap-1.5 rounded-xl px-4 py-4 text-sm font-bold text-white/80 transition hover:text-white"
            >
              Follow Challenge <ArrowRight className="h-4 w-4" />
            </Link>
          </motion.div>
        </div>
      </div>
    </section>
  );
}