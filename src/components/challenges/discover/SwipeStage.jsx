import { motion, useReducedMotion } from 'framer-motion';

const THRESHOLD = 60;

/**
 * Reels-style swipe surface: drag up/down to move between participants,
 * left/right to move through one participant's content. Snaps back if the
 * drag is too small or there's nothing in that direction.
 */
export default function SwipeStage({ children, className = '', canUp, canDown, canLeft, canRight, onUp, onDown, onLeft, onRight }) {
  const reduced = useReducedMotion();

  const handleDragEnd = (_e, info) => {
    const { offset, velocity } = info;
    const horizontal = Math.abs(offset.x) > Math.abs(offset.y);
    if (horizontal) {
      const past = Math.abs(offset.x) > THRESHOLD || Math.abs(velocity.x) > 400;
      if (!past) return;
      if (offset.x < 0 && canRight) onRight();
      else if (offset.x > 0 && canLeft) onLeft();
    } else {
      const past = Math.abs(offset.y) > THRESHOLD || Math.abs(velocity.y) > 400;
      if (!past) return;
      if (offset.y < 0 && canDown) onDown();
      else if (offset.y > 0 && canUp) onUp();
    }
  };

  return (
    <motion.div
      className={`touch-none ${className}`}
      drag
      dragElastic={0.25}
      dragMomentum={false}
      dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
      onDragEnd={handleDragEnd}
      initial={reduced ? false : { opacity: 0, scale: 0.98 }}
      animate={reduced ? false : { opacity: 1, scale: 1 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}