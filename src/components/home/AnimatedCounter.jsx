import { useRef, useState, useEffect } from 'react';
import { useInView, useReducedMotion, animate } from 'framer-motion';

/**
 * Animates a number counting up from 0 to `value` when scrolled into view.
 * Uses Framer Motion's animate() for smooth interpolation.
 * Animates from previous value to new value if value changes.
 * Respects prefers-reduced-motion.
 */
export default function AnimatedCounter({ value = 0, duration = 900 }) {
  const [display, setDisplay] = useState(0);
  const ref = useRef(null);
  const inView = useInView(ref, { once: false, amount: 0.5 });
  const reducedMotion = useReducedMotion();
  const prevRef = useRef(0);
  const startedRef = useRef(false);

  useEffect(() => {
    if (!inView) return;

    const target = typeof value === 'number' ? value : parseInt(String(value).replace(/[^0-9]/g, ''), 10) || 0;
    const prev = startedRef.current ? prevRef.current : 0;

    if (reducedMotion) {
      setDisplay(target);
      prevRef.current = target;
      startedRef.current = true;
      return;
    }

    startedRef.current = true;
    const controls = animate(prev, target, {
      duration: duration / 1000,
      ease: 'easeOut',
      onUpdate: (val) => setDisplay(Math.round(val)),
    });

    prevRef.current = target;
    return () => controls.stop();
  }, [inView, value, duration, reducedMotion]);

  return <span ref={ref}>{display.toLocaleString()}</span>;
}