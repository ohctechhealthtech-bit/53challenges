import { Link } from 'react-router-dom';
import { Vote, MapPin, ArrowRight, Play } from 'lucide-react';
import { motion, useReducedMotion, AnimatePresence } from 'framer-motion';
import { Image } from '@/components/ui/image';
import { DURATION, EASE, STAGGER, VARIANTS } from '@/lib/motion';

function VotingCard({ entry, index }) {
  const reduced = useReducedMotion();
  const thumb = entry.work_url || entry.thumbnail || entry.cover_image || '';
  const creatorName = entry.creator_name || entry.submitter_name || 'Anonymous creator';
  const state = entry.state || '';
  const challengeName = entry.challenge_title || entry.challenge_name || '';

  return (
    <motion.div
      variants={reduced ? { hidden: { opacity: 0 }, visible: { opacity: 1 } } : VARIANTS.fadeUp}
      className="card-lift group flex flex-col overflow-hidden rounded-2xl border border-border bg-card"
    >
      <div className="relative aspect-video overflow-hidden bg-muted">
        {thumb ? (
          <Image src={thumb} alt={creatorName} className="h-full w-full" fittingType="fill" />
        ) : (
          <div className="grid h-full w-full place-items-center bg-muted text-muted-foreground">
            <Play className="h-8 w-8" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-purple-600 px-3 py-1 text-xs font-bold text-white">
          <Vote className="h-3 w-3" /> Voting Open
        </span>
      </div>
      <div className="flex flex-1 flex-col p-5">
        <h3 className="font-heading text-lg font-bold leading-snug">{creatorName}</h3>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {state && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3 w-3" /> {state}
            </span>
          )}
          {challengeName && <span className="truncate">{challengeName}</span>}
        </div>
        <Link
          to={`/challenges/${entry.challenge_id}`}
          className="btn-bounce mt-4 inline-flex items-center gap-1.5 self-start rounded-xl bg-purple-600 px-4 py-2 text-sm font-bold text-white transition hover:brightness-110"
        >
          <Vote className="h-4 w-4" /> Vote Now
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </motion.div>
  );
}

export default function VotingSection({ entries = [], loading }) {
  const reduced = useReducedMotion();
  const list = (entries || []).slice(0, 3);

  return (
    <section className="container-tight py-12 lg:py-16">
      <div className="mb-8 text-center">
        <p className="text-sm font-semibold uppercase tracking-wider text-purple-400">Community Voting</p>
        <h2 className="mt-2 font-heading text-3xl font-bold text-balance sm:text-4xl">
          Help Australia choose what rises next.
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
          Your vote matters. Public voting is part of the final result, combined with independent
          judging panels to ensure a fair, transparent outcome for every challenge.
        </p>
      </div>

      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
          >
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="animate-pulse rounded-2xl border border-border bg-card">
                <div className="aspect-video rounded-t-2xl bg-muted" />
                <div className="space-y-3 p-5">
                  <div className="h-5 w-2/3 rounded bg-muted" />
                  <div className="h-4 w-1/2 rounded bg-muted" />
                  <div className="h-9 w-32 rounded bg-muted" />
                </div>
              </div>
            ))}
          </motion.div>
        ) : list.length > 0 ? (
          <motion.div
            key="entries"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.1 }}
            variants={reduced ? { hidden: {}, visible: {} } : VARIANTS.staggerContainer(STAGGER.base)}
            className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
          >
            {list.map((entry, i) => (
              <VotingCard key={entry.id || `entry-${i}`} entry={entry} index={i} />
            ))}
          </motion.div>
        ) : (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="rounded-2xl border border-dashed border-border py-12 text-center"
          >
            <Vote className="mx-auto h-10 w-10 text-muted-foreground/50" />
            <p className="mt-3 text-sm text-muted-foreground">
              No entries are open for voting right now.
            </p>
            <Link
              to="/challenges"
              className="mt-4 inline-flex items-center gap-1.5 rounded-xl border border-border px-4 py-2 text-sm font-bold text-foreground transition hover:border-primary hover:text-primary"
            >
              Browse all challenges <ArrowRight className="h-4 w-4" />
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}