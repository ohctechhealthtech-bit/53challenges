import { Link } from 'react-router-dom';
import { useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Image } from '@/components/ui/image';
import {
  categoryMeta,
  challengeStatus,
  challengeTitle,
  challengeDescription,
  daysLeft,
  isPublicChallenge,
} from '@/lib/challenges-data';
import CategoryIcon from '@/components/home/CategoryIcon';
import RevealOnScroll from '@/components/home/RevealOnScroll';
import { RowSkeleton } from '@/components/motion/Skeleton';
import { DURATION, EASE, STAGGER, VARIANTS } from '@/lib/motion';
import {
  ArrowRight,
  Trophy,
} from 'lucide-react';

function ChallengeCard({ ch }) {
  const reduced = useReducedMotion();
  const status = challengeStatus(ch);
  const cat = categoryMeta(ch.category);
  const isNational = (ch.geography || '').toLowerCase() === 'national';
  const deadline = status.phase === 'vote' ? ch.voting_ends_at : ch.submission_ends_at;
  const deadlineLabel = deadline
    ? new Date(deadline).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
    : '';
  const countdown =
    status.phase === 'upcoming' ? `Starts in ${daysLeft(ch.starts_at)}d` :
    status.phase === 'submit' ? `Closes in ${daysLeft(ch.submission_ends_at)}d` :
    status.phase === 'vote' ? `Voting ends in ${daysLeft(ch.voting_ends_at)}d` : 'Ended';
  const prize = ch.prize_pool || '';
  const evidence = ch.evidence || 'Video entry';
  const organiser = ch.organisation || ch.organiser_name || (isNational ? '53 Challenges' : '');
  const title = challengeTitle(ch);
  const desc = challengeDescription(ch);

  // Always land on the challenge intro page first.
  const to = `/challenges/${ch.id}`;

  const ctaText =
    status.phase === 'submit' ? 'Enter Now' :
    status.phase === 'vote' ? 'Watch & Vote' :
    status.phase === 'upcoming' ? 'Notify Me' : 'View';
  const ctaColour =
    status.phase === 'submit' ? '#ff4d4d' :
    status.phase === 'vote' ? '#00a8a8' :
    status.phase === 'upcoming' ? '#d4af37' : '#ff4d4d';

  const pathwayLabel = isNational ? 'National Competition' : (ch.state ? `${ch.state} & National Pathway` : 'State & National Pathway');
  const metaLine = status.phase === 'vote'
    ? 'Voting open now'
    : deadlineLabel
      ? `Entries close ${deadlineLabel}`
      : countdown;

  return (
    <motion.div
      variants={reduced ? { hidden: { opacity: 0 }, visible: { opacity: 1 } } : VARIANTS.fadeUp}
      whileHover={{ y: -4 }}
      transition={{ duration: DURATION.base, ease: EASE.inOut }}
      className="card-lift flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card"
    >
      {/* Cover image */}
      <div className="relative h-44 overflow-hidden" style={{ backgroundColor: cat.color + '15' }}>
        {ch.cover_image ? (
          <Image src={ch.cover_image} alt={title} className="h-full w-full" fittingType="fill" />
        ) : (
          <div className="grid h-full w-full place-items-center">
            <CategoryIcon slug={cat.slug} className="h-12 w-12 opacity-25" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
        <span
          className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold text-white"
          style={{ backgroundColor: status.colour }}
        >
          {status.label}
        </span>
      </div>

      {/* Card body — clean, spec-matching layout */}
      <div className="flex flex-1 flex-col p-5">
        <h3 className="font-heading text-lg font-bold leading-snug">{title}</h3>
        <p className="mt-1 text-xs font-medium text-muted-foreground">{pathwayLabel}</p>
        <p className="mt-2 text-sm text-muted-foreground">{metaLine}</p>
        <div className="mt-auto pt-4">
          <Link
            to={to}
            className="inline-flex items-center gap-1 text-sm font-bold transition hover:underline"
            style={{ color: ctaColour }}
          >
            {ctaText} <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </motion.div>
  );
}

function SoonRow({ item }) {
  const cat = categoryMeta(item.category);
  return (
    <motion.div
      variants={VARIANTS.fadeUp}
      whileHover={{ y: -4 }}
      transition={{ duration: DURATION.base, ease: EASE.inOut }}
      className="card-lift flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card"
    >
      <div className="relative h-44 overflow-hidden" style={{ backgroundColor: cat.color + '15' }}>
        <div className="grid h-full w-full place-items-center">
          <CategoryIcon slug={cat.slug} className="h-12 w-12 opacity-25" />
        </div>
        <span
          className="absolute left-3 top-3 rounded-full px-3 py-1 text-xs font-bold text-white"
          style={{ backgroundColor: '#d4af37' }}
        >
          Coming Soon
        </span>
      </div>
      <div className="flex flex-1 flex-col p-5">
        <h3 className="font-heading text-lg font-bold leading-snug">{item.name}</h3>
        <p className="mt-1 text-xs font-medium text-muted-foreground">{item.subcategory || cat.name}</p>
        <p className="mt-2 text-sm text-muted-foreground">Starts soon</p>
        <div className="mt-auto pt-4">
          <Link
            to="/coming-soon"
            className="inline-flex items-center gap-1 text-sm font-bold transition hover:underline"
            style={{ color: '#d4af37' }}
          >
            Notify Me <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </motion.div>
  );
}

function EmptyState({ tab, onSwitch }) {
  const alt = tab === 'submit' ? { label: 'Vote Live', to: '/challenges?phase=vote' } : tab === 'vote' ? { label: 'Explore Challenges', to: '/challenges' } : { label: 'Explore Challenges', to: '/challenges' };
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-border py-10 text-center">
      <Trophy className="h-8 w-8 text-muted-foreground/50" />
      <p className="mt-3 text-sm font-medium text-muted-foreground">
        {tab === 'submit' && 'No challenges are open for entries right now.'}
        {tab === 'vote' && 'No challenges are open for voting right now.'}
        {tab === 'soon' && 'No upcoming challenges announced yet.'}
      </p>
      <Link to={alt.to} className="mt-4 inline-flex items-center gap-1.5 rounded-xl border border-border px-4 py-2 text-sm font-bold text-foreground transition hover:border-primary hover:text-primary">
        {alt.label} <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}

export default function LiveNowTabs({ challenges = [], comingSoon = [], loading }) {
  const reduced = useReducedMotion();
  const [tab, setTab] = useState('submit');

  const live = (challenges || []).filter(isPublicChallenge);
  const open = live.filter((c) => challengeStatus(c).phase === 'submit');
  const voting = live.filter((c) => challengeStatus(c).phase === 'vote');
  const upcomingLive = live.filter((c) => challengeStatus(c).phase === 'upcoming');
  const soon = (comingSoon || []).filter((i) => i.status === 'coming_soon');
  const soonCount = soon.length + upcomingLive.length;

  const tabs = [
    { id: 'submit', label: 'Open for Entries', count: open.length },
    { id: 'vote', label: 'Voting Now', count: voting.length },
    { id: 'soon', label: 'Coming Soon', count: soonCount },
  ];

  let rows = [];
  if (tab === 'submit') rows = open.slice(0, 8).map((ch) => <ChallengeCard key={ch.id} ch={ch} />);
  else if (tab === 'vote') rows = voting.slice(0, 8).map((ch) => <ChallengeCard key={ch.id} ch={ch} />);
  else rows = [
    ...upcomingLive.slice(0, 4).map((ch) => <ChallengeCard key={ch.id} ch={ch} />),
    ...soon.slice(0, 4).map((i) => <SoonRow key={i.id} item={i} />),
  ];

  return (
    <RevealOnScroll as="section" className="container-tight py-12 lg:py-16">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-primary">Live Now</p>
          <h2 className="mt-1 font-heading text-2xl font-bold sm:text-3xl">Competitions this season</h2>
        </div>
        <div className="inline-flex rounded-xl border border-border bg-card p-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`relative rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                tab === t.id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {t.label}
              {t.count > 0 && <span className="ml-1.5 opacity-70">({t.count})</span>}
            </button>
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: DURATION.fast }}
            className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4"
          >
            {Array.from({ length: 4 }).map((_, i) => (
              <RowSkeleton key={i} />
            ))}
          </motion.div>
        ) : rows.length > 0 ? (
          <motion.div
            key={tab}
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, y: -8 }}
            transition={{ duration: DURATION.base, ease: EASE.out }}
            className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4"
          >
            {rows}
          </motion.div>
        ) : (
          <motion.div
            key={`empty-${tab}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: DURATION.fast }}
          >
            <EmptyState tab={tab} />
          </motion.div>
        )}
      </AnimatePresence>
    </RevealOnScroll>
  );
}