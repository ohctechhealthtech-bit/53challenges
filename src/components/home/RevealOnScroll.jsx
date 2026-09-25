import { useRef } from 'react';
import { motion, useInView, useReducedMotion } from 'framer-motion';
import { VARIANTS, REDUCED_VARIANTS, VIEWPORT } from '@/lib/motion';

const variantMap = {
  up: 'fadeUp',
  left: 'slideLeft',
  right: 'slideRight',
  scale: 'scaleIn',
  zoom: 'scaleIn',
  fade: 'fadeIn',
};

/**
 * Wraps content and reveals it with Framer Motion when scrolled into view.
 * Set `stagger` to animate children one after another via CSS nth-child delays.
 * Respects prefers-reduced-motion.
 * Uses centralized motion tokens from @/lib/motion.
 */
export default function RevealOnScroll({ children, className = '', delay = 0, stagger = false, variant = 'up', as = 'div' }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, amount: 0.15 });
  const reducedMotion = useReducedMotion();

  const variantKey = variantMap[variant] || 'fadeUp';
  const baseVariant = reducedMotion ? REDUCED_VARIANTS : (VARIANTS[variantKey] || VARIANTS.fadeUp);
  const MotionTag = motion[as] || motion.div;

  if (stagger) {
    return (
      <MotionTag
        ref={ref}
        className={`stagger-${variant} ${inView ? 'is-visible' : ''} ${className}`}
        initial="hidden"
        animate={inView ? 'visible' : 'hidden'}
        variants={reducedMotion ? REDUCED_VARIANTS : VARIANTS.staggerContainer(0.08, delay)}
        transition={{ delay }}
      >
        {children}
      </MotionTag>
    );
  }

  return (
    <MotionTag
      ref={ref}
      className={className}
      initial="hidden"
      animate={inView ? 'visible' : 'hidden'}
      variants={baseVariant}
      transition={{ delay }}
    >
      {children}
    </MotionTag>
  );
}