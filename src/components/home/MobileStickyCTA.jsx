import { Link } from 'react-router-dom';
import { Compass, Vote } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { DURATION, EASE } from '@/lib/motion';

/**
 * Sticky bottom bar on mobile — gives users a persistent Explore / Vote CTA
 * without taking up screen space on desktop (hidden md:hidden).
 */
export default function MobileStickyCTA() {
  const reduced = useReducedMotion();
  return (
    <motion.div
      initial={reduced ? { opacity: 0 } : { y: 60, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: DURATION.base, ease: EASE.out, delay: 0.5 }}
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-background/95 backdrop-blur-xl md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex items-center gap-2 px-4 py-2.5">
        <Link
          to="/challenges"
          className="btn-bounce flex flex-1 items-center justify-center gap-1.5 rounded-xl grad-bg px-4 py-3 text-sm font-bold text-white"
        >
          <Compass className="h-4 w-4" /> Explore
        </Link>
        <Link
          to="/challenges?phase=vote"
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-border bg-white/5 px-4 py-3 text-sm font-bold text-foreground transition hover:border-primary hover:text-primary"
        >
          <Vote className="h-4 w-4" /> Vote
        </Link>
      </div>
    </motion.div>
  );
}