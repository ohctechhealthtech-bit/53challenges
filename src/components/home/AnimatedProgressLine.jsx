import { useEffect, useRef, useState } from 'react';

/**
 * A progress line that draws (scaleX/scaleY from 0 to 1) once when scrolled into view.
 * Respects prefers-reduced-motion.
 */
export default function AnimatedProgressLine({ className = '', direction = 'horizontal', duration = 1500 }) {
  const ref = useRef(null);
  const [drawn, setDrawn] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setDrawn(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setDrawn(true);
          observer.disconnect();
        }
      },
      { threshold: 0.3 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const dir = direction === 'vertical' ? 'progress-line-vertical' : '';
  return (
    <div
      ref={ref}
      className={`progress-line-draw ${drawn ? 'is-drawn' : ''} ${dir} ${className}`}
      style={{ transitionDuration: `${duration}ms` }}
    />
  );
}