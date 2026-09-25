import { Link } from 'react-router-dom';
import { Trophy, Vote, Building2, ArrowRight } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { DURATION, EASE, STAGGER, VARIANTS } from '@/lib/motion';

const PATHS = [
  {
    icon: Trophy,
    title: 'Compete',
    subtitle: 'Show Australia what you can do',
    body: 'Enter a challenge, submit your original work and climb from your state to the national stage.',
    cta: 'Find a Challenge',
    to: '/challenges',
    accent: '#ff4d4d',
  },
  {
    icon: Vote,
    title: 'Vote',
    subtitle: 'Help discover the next winner',
    body: 'Watch entries from across the country and vote for the talent that moves you most.',
    cta: 'Watch & Vote',
    to: '/challenges?phase=vote',
    accent: '#8b5cf6',
  },
  {
    icon: Building2,
    title: 'Host',
    subtitle: 'Turn your audience into active participants',
    body: 'Sponsor or run a branded challenge — we handle the platform, promotion and judging.',
    cta: 'Run a Challenge',
    to: '/run-a-challenge',
    accent: '#f0932b',
  },
];

export default function ParticipationPaths() {
  const reduced = useReducedMotion();

  return (
    <section className="container-tight py-12 lg:py-16">
      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.2 }}
        variants={reduced ? { hidden: {}, visible: {} } : VARIANTS.staggerContainer(STAGGER.base)}
        className="grid gap-5 sm:grid-cols-3"
      >
        {PATHS.map((p) => (
          <motion.div
            key={p.title}
            variants={reduced ? { hidden: { opacity: 0 }, visible: { opacity: 1 } } : VARIANTS.fadeUp}
            className="card-lift group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-card p-7"
          >
            <div
              className="absolute -right-6 -top-6 h-24 w-24 rounded-full opacity-10 transition-transform duration-500 group-hover:scale-150"
              style={{ backgroundColor: p.accent }}
            />
            <span
              className="grid h-14 w-14 place-items-center rounded-2xl"
              style={{ backgroundColor: p.accent + '22', color: p.accent }}
            >
              <p.icon className="h-7 w-7" />
            </span>
            <h3 className="mt-5 font-heading text-xl font-bold">{p.title}</h3>
            <p className="mt-1 text-sm font-semibold" style={{ color: p.accent }}>{p.subtitle}</p>
            <p className="mt-3 flex-1 text-sm text-muted-foreground">{p.body}</p>
            <Link
              to={p.to}
              className="mt-5 inline-flex items-center gap-1.5 text-sm font-bold text-foreground transition-colors hover:text-primary"
            >
              {p.cta}
              <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
            </Link>
          </motion.div>
        ))}
      </motion.div>
    </section>
  );
}