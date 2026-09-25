import { useEffect, useRef } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Check } from 'lucide-react';
import confetti from 'canvas-confetti';
import { DURATION, EASE } from '@/lib/motion';

/**
 * Lightweight confetti burst using canvas-confetti.
 * Only fires after a genuinely successful vote.
 * Disabled entirely when prefers-reduced-motion is active.
 */
export function ConfettiBurst({ trigger }) {
  const reduced = useReducedMotion();
  const lastTrigger = useRef(null);

  useEffect(() => {
    if (!trigger || reduced || trigger === lastTrigger.current) return;
    lastTrigger.current = trigger;
    const colors = ['#ff4d4d', '#ff7878', '#f59e0b', '#10b981', '#6366f1'];
    confetti({
      particleCount: 60,
      spread: 60,
      origin: { y: 0.65 },
      colors,
      duration: 1200,
      disableForReducedMotion: true,
    });
  }, [trigger, reduced]);

  return null;
}

/**
 * Checkmark + pulse animation shown after a successful vote.
 * Renders inline next to the vote button — never covers content.
 */
export function VoteSuccessBadge({ show }) {
  const reduced = useReducedMotion();
  return (
    <AnimatePresence>
      {show && (
        <motion.span
          initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.5 }}
          animate={reduced ? { opacity: 1 } : { opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.5, transition: { duration: DURATION.fast } }}
          transition={reduced ? { duration: 0.15 } : EASE.spring}
          className="pointer-events-none absolute -top-1 -right-1 grid h-5 w-5 place-items-center rounded-full bg-emerald-500 text-white shadow-sm"
          aria-hidden="true"
        >
          <Check className="h-3 w-3" strokeWidth={3.5} />
        </motion.span>
      )}
    </AnimatePresence>
  );
}

/**
 * Subtle shake animation for failed vote or validation error.
 */
export function ShakeOnError({ trigger, children }) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      animate={
        trigger && !reduced
          ? { x: [0, -6, 6, -4, 4, 0] }
          : { x: 0 }
      }
      transition={trigger && !reduced ? { duration: 0.4, ease: 'easeInOut' } : { duration: 0 }}
    >
      {children}
    </motion.div>
  );
}

export default { ConfettiBurst, VoteSuccessBadge, ShakeOnError };