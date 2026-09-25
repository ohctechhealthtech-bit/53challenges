import { Link } from 'react-router-dom';
import { Trophy, MapPin, Award, ArrowRight } from 'lucide-react';
import { motion, useReducedMotion, AnimatePresence } from 'framer-motion';
import { Image } from '@/components/ui/image';
import { DURATION, EASE, STAGGER, VARIANTS } from '@/lib/motion';

function WinnerCard({ winner, index }) {
  const reduced = useReducedMotion();
  const image = winner.image_url || winner.cover_image || winner.work_url || '';
  const name = winner.creator_name || winner.winner_name || 'Winner';
  const state = winner.state || '';
  const challenge = winner.challenge_title || winner.challenge_name || '';
  const awardType = winner.award_type || winner.placing_label || 'Winner';

  return (
    <motion.div
      variants={reduced ? { hidden: { opacity: 0 }, visible: { opacity: 1 } } : VARIANTS.fadeUp}
      className="card-lift group flex flex-col overflow-hidden rounded-2xl border border-border bg-card"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-muted">
        {image ? (
          <Image src={image} alt={name} className="h-full w-full" fittingType="fill" />
        ) : (
          <div className="grid h-full w-full place-items-center bg-gradient-to-br from-amber-500/10 to-primary/10">
            <Trophy className="h-12 w-12 text-amber-400/60" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-amber-500 px-3 py-1 text-xs font-bold text-white">
          <Award className="h-3 w-3" /> {awardType}
        </span>
      </div>
      <div className="flex flex-1 flex-col p-5">
        <h3 className="font-heading text-lg font-bold">{name}</h3>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {state && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3 w-3" /> {state}
            </span>
          )}
          {challenge && <span className="truncate">{challenge}</span>}
        </div>
        {winner.id && (
          <Link
            to={`/challenges/${winner.challenge_id}`}
            className="mt-4 inline-flex items-center gap-1.5 self-start rounded-xl border border-border px-4 py-2 text-sm font-bold text-foreground transition hover:border-amber-500 hover:text-amber-400"
          >
            View Winning Entry <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>
    </motion.div>
  );
}

export default function LatestWinners({ winners = [], loading }) {
  const reduced = useReducedMotion();
  const list = (winners || []).slice(0, 3);

  return (
    <section className="container-tight py-12 lg:py-16">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-amber-400">Hall of Fame</p>
          <h2 className="mt-2 font-heading text-3xl font-bold text-balance sm:text-4xl">Latest Winners</h2>
        </div>
        <Link
          to="/hall-of-fame"
          className="inline-flex items-center gap-1.5 rounded-xl border border-border px-5 py-2.5 text-sm font-bold text-foreground transition hover:border-amber-500 hover:text-amber-400"
        >
          Explore Hall of Fame <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="animate-pulse rounded-2xl border border-border bg-card">
                <div className="aspect-[4/3] rounded-t-2xl bg-muted" />
                <div className="space-y-3 p-5">
                  <div className="h-5 w-2/3 rounded bg-muted" />
                  <div className="h-4 w-1/2 rounded bg-muted" />
                </div>
              </div>
            ))}
          </motion.div>
        ) : list.length > 0 ? (
          <motion.div
            key="winners"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.1 }}
            variants={reduced ? { hidden: {}, visible: {} } : VARIANTS.staggerContainer(STAGGER.base)}
            className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
          >
            {list.map((w, i) => (
              <WinnerCard key={w.id || `winner-${i}`} winner={w} index={i} />
            ))}
          </motion.div>
        ) : (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="rounded-2xl border border-dashed border-border py-12 text-center"
          >
            <Trophy className="mx-auto h-10 w-10 text-muted-foreground/50" />
            <p className="mt-3 text-sm text-muted-foreground">
              Winners will be announced after the current season's audited results are finalised.
            </p>
            <Link
              to="/hall-of-fame"
              className="mt-4 inline-flex items-center gap-1.5 rounded-xl border border-border px-4 py-2 text-sm font-bold text-foreground transition hover:border-amber-500 hover:text-amber-400"
            >
              Explore Hall of Fame <ArrowRight className="h-4 w-4" />
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}