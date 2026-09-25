import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Send, Heart, ArrowRight, AlertTriangle } from 'lucide-react';

export default function IntroChoiceCards({ challenge, intro, accent, entriesCount, complianceBlocked }) {
  const participateLabel = intro.cta_participate_label || 'Participate';
  const voteLabel = intro.cta_vote_label || 'Vote for entries';

  if (complianceBlocked) {
    return (
      <div className="container-tight -mt-8 relative z-10">
        <div className="flex items-center gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-5 text-sm font-semibold text-amber-300 backdrop-blur">
          <AlertTriangle className="h-5 w-5 shrink-0" /> Entries &amp; voting are paused for this challenge pending review.
        </div>
      </div>
    );
  }

  const cards = [
    {
      to: `/challenges/${challenge.id}/submit`,
      icon: Send,
      label: participateLabel,
      text: 'Create your work and enter this challenge.',
      primary: true,
    },
    {
      to: `/challenges/${challenge.id}/vote`,
      icon: Heart,
      label: voteLabel,
      text: `Browse ${entriesCount} entr${entriesCount === 1 ? 'y' : 'ies'} and vote for your favourites.`,
      primary: false,
    },
  ];

  return (
    <div className="container-tight relative z-10 -mt-10">
      <div className="grid gap-4 sm:grid-cols-2">
        {cards.map((c, i) => (
          <motion.div
            key={c.to}
            initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.25 + i * 0.12, ease: [0.16, 1, 0.3, 1] }}
          >
            <Link
              to={c.to}
              className={`group flex h-full items-center gap-4 rounded-2xl border p-6 shadow-xl transition-transform hover:-translate-y-1 ${
                c.primary
                  ? `bg-gradient-to-r ${accent.grad} border-transparent text-white`
                  : `bg-card ${accent.border} text-foreground`
              }`}
            >
              <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl ${c.primary ? 'bg-white/20' : accent.soft}`}>
                <c.icon className={`h-6 w-6 ${c.primary ? 'text-white' : accent.text}`} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-heading text-lg font-bold">{c.label}</span>
                <span className={`block text-sm ${c.primary ? 'text-white/85' : 'text-muted-foreground'}`}>{c.text}</span>
              </span>
              <ArrowRight className={`h-5 w-5 shrink-0 transition-transform group-hover:translate-x-1 ${c.primary ? 'text-white' : accent.text}`} />
            </Link>
          </motion.div>
        ))}
      </div>
    </div>
  );
}