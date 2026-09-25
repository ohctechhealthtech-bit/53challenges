import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';

const AUTO_INTERVAL = 5000;

export default function HeroImageCarousel({ images = [], alt = '' }) {
  const reducedMotion = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  const next = useCallback(() => {
    setIndex((i) => (i + 1) % images.length);
  }, [images.length]);

  useEffect(() => {
    if (reducedMotion || paused || images.length <= 1) return;
    const timer = setInterval(next, AUTO_INTERVAL);
    return () => clearInterval(timer);
  }, [reducedMotion, paused, images.length, next]);

  if (!images.length) return null;

  return (
    <div
      className="group relative overflow-hidden rounded-[20px] border border-white/10 shadow-2xl shadow-black/60 transition-shadow duration-500 hover:shadow-[0_0_40px_rgba(109,74,255,0.3)]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="relative aspect-[4/3] w-full">
        <AnimatePresence initial={false}>
          <motion.img
            key={index}
            src={images[index]}
            alt={alt}
            initial={{ opacity: 0, scale: reducedMotion ? 1 : 1.05 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reducedMotion ? 0 : 1.2, ease: 'easeInOut' }}
            className="absolute inset-0 h-full w-full object-cover"
          />
        </AnimatePresence>
        {/* Legibility overlay */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-black/45 via-black/10 to-transparent" />
      </div>

      {/* Dot indicators */}
      {images.length > 1 && (
        <div className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 gap-2">
          {images.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setIndex(i)}
              className={`h-2 rounded-full transition-all duration-300 ${
                i === index ? 'w-6 bg-primary' : 'w-2 bg-white/40 hover:bg-white/60'
              }`}
              aria-label={`Go to slide ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}