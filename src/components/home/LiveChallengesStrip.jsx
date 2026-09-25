import { Link } from 'react-router-dom';
import ChallengeLink from '@/components/challenges/ChallengeLink';
import { Clock, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { Image } from '@/components/ui/image';
import { challengePhase, daysLeft } from '@/lib/challenges-data';
import RevealOnScroll from '@/components/home/RevealOnScroll';

function phaseBadge(phase) {
  if (phase === 'upcoming') return { label: 'Upcoming', cls: 'bg-amber-500/15 text-amber-300 border-amber-500/30' };
  if (phase === 'closed') return { label: 'Ended', cls: 'bg-muted text-muted-foreground border-border' };
  return { label: 'Live', cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30', live: true };
}

function countdownLabel(ch) {
  const phase = challengePhase(ch);
  if (phase === 'upcoming') return `Starts in ${daysLeft(ch.starts_at)}d`;
  if (phase === 'submit') return `Closes in ${daysLeft(ch.submission_ends_at)}d`;
  if (phase === 'vote') return `Voting ends in ${daysLeft(ch.voting_ends_at)}d`;
  return 'Ended';
}

// Exclude QA / test / seeded / null-title challenges and ended challenges.
function isLiveChallenge(ch) {
  if (!ch) return false;
  const title = (ch.title || ch.theme || '').trim();
  if (!title) return false;
  const text = `${title} ${ch.description || ''}`.toLowerCase();
  if (/\b(qa|test|seed|demo|mock|placeholder)\b/i.test(text)) return false;
  // Exclude ended challenges from the "live" strip.
  if (challengePhase(ch) === 'closed') return false;
  return true;
}

export default function LiveChallengesStrip({ challenges, loading }) {
  const list = (challenges || []).filter(isLiveChallenge).slice(0, 12);
  return (
    <RevealOnScroll as="section" className="container-tight overflow-x-hidden py-12">
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-primary">Live right now</p>
          <h2 className="mt-1 font-heading text-2xl font-bold sm:text-3xl">Live Challenges</h2>
        </div>
        <Link to="/challenges" className="group whitespace-nowrap text-sm font-semibold text-primary hover:underline">View all <span className="inline-block transition-transform duration-200 group-hover:translate-x-0.5">→</span></Link>
      </div>
      <div className="-mx-5 flex gap-4 overflow-x-auto px-5 pb-4 scrollbar-hide snap-x">
        {loading && Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-44 w-72 shrink-0 snap-start animate-pulse rounded-2xl border border-border bg-card p-5" />
        ))}
        {!loading && list.length === 0 && <p className="text-sm text-muted-foreground">No live challenges right now.</p>}
        {list.map((c, i) => {
          const b = phaseBadge(challengePhase(c));
          return (
            <motion.div
              key={c.id}
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{
                type: 'spring',
                stiffness: 260,
                damping: 18,
                delay: i * 0.1,
              }}
              className="card-lift group flex w-72 shrink-0 snap-start flex-col rounded-2xl border border-border bg-card p-5 transition-all duration-300 hover:-translate-y-1.5 hover:scale-[1.01] hover:border-primary/40 hover:shadow-xl hover:shadow-primary/20 focus-within:border-primary/40 focus-within:shadow-xl focus-within:shadow-primary/20"
            >
              <div className="flex items-center justify-between">
                <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${b.cls} ${b.live ? 'live-glow' : ''}`}>
                  {b.live && (
                    <motion.span
                      className="h-1.5 w-1.5 rounded-full bg-emerald-400"
                      animate={{ scale: [1, 1.4, 1], opacity: [1, 0.5, 1] }}
                      transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                    />
                  )}
                  {b.label}
                </span>
                <span className="attention-pulse flex items-center gap-1 text-xs text-muted-foreground"><Clock className="h-3.5 w-3.5" />{countdownLabel(c)}</span>
              </div>
              {c.cover_image && (
                <div className="mt-3 h-24 w-full overflow-hidden rounded-lg">
                  <Image src={c.cover_image} alt={c.theme || c.title} className="h-full w-full transition-transform duration-500 group-hover:scale-110" fittingType="fill" />
                </div>
              )}
              <h3 className="mt-3 line-clamp-2 font-heading text-lg font-bold leading-tight">{c.theme || c.title}</h3>
              <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">{c.brief}</p>
              <ChallengeLink challengeId={c.id} className="btn-glow btn-bounce mt-4 inline-flex items-center justify-center gap-1.5 rounded-xl grad-bg px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110">
                View Entries <ChevronRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
              </ChallengeLink>
            </motion.div>
          );
        })}
      </div>
    </RevealOnScroll>
  );
}