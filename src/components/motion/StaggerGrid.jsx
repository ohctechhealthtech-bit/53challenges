import { motion, useReducedMotion } from 'framer-motion';
import { VARIANTS, VIEWPORT, STAGGER, REDUCED_VARIANTS } from '@/lib/motion';

/**
 * Staggered grid entrance — children fade up one after another.
 * Each child must be a <StaggerItem> for the stagger to apply.
 * Animates once per page visit (viewport.once = true).
 */
export function StaggerGrid({ children, className = '', stagger = STAGGER.base, delayChildren = 0, as = 'div' }) {
  const reduced = useReducedMotion();
  const variants = reduced ? REDUCED_VARIANTS : VARIANTS.staggerContainer(stagger, delayChildren);
  const MotionTag = motion[as] || motion.div;

  return (
    <MotionTag
      initial="hidden"
      whileInView="visible"
      viewport={VIEWPORT}
      variants={variants}
      className={className}
    >
      {children}
    </MotionTag>
  );
}

/**
 * Individual item inside a StaggerGrid — fades up.
 */
export function StaggerItem({ children, className = '', as = 'div' }) {
  const reduced = useReducedMotion();
  const variants = reduced ? REDUCED_VARIANTS : VARIANTS.staggerChild;
  const MotionTag = motion[as] || motion.div;

  return (
    <MotionTag variants={variants} className={className}>
      {children}
    </MotionTag>
  );
}

export default { StaggerGrid, StaggerItem };