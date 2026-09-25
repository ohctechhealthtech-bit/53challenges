/**
 * Global motion system — single source of truth for all animation tokens,
 * variants, and presets used across 53 Challenges.
 *
 * Every animation in the app should import from here so timing, easing,
 * and variant shapes stay consistent.
 */

// ─── Timing tokens (ms) ──────────────────────────────────────────────
export const DURATION = {
  micro: 0.12,      // micro-interactions (toggles, ripples)
  fast: 0.18,       // button presses, icon rotations
  base: 0.28,       // card hover, nav transitions
  section: 0.5,     // section entrance reveals
  modal: 0.28,      // modal / drawer open
  page: 0.35,       // page transition
  celebration: 1.2, // confetti, winner reveal (max 2s)
};

// ─── Easing presets ──────────────────────────────────────────────────
export const EASE = {
  out: [0.16, 1, 0.3, 1],        // standard entrance
  inOut: [0.4, 0, 0.2, 1],       // interactive movement
  in: [0.4, 0, 1, 1],            // exit
  spring: { type: 'spring', stiffness: 400, damping: 25 }, // small confirmations
};

// ─── Stagger config ─────────────────────────────────────────────────
export const STAGGER = {
  fast: 0.05,   // 50ms between items
  base: 0.08,   // 80ms between items (default)
  slow: 0.12,   // 120ms between items
};

// ─── Entrance variants ──────────────────────────────────────────────
export const VARIANTS = {
  // Fade Up — most common section/card entrance
  fadeUp: {
    hidden: { opacity: 0, y: 24 },
    visible: { opacity: 1, y: 0, transition: { duration: DURATION.section, ease: EASE.out } },
  },
  // Fade In — subtle, for overlays/toasts
  fadeIn: {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: DURATION.section, ease: EASE.out } },
  },
  // Slide from left
  slideLeft: {
    hidden: { opacity: 0, x: -32 },
    visible: { opacity: 1, x: 0, transition: { duration: DURATION.section, ease: EASE.out } },
  },
  // Slide from right
  slideRight: {
    hidden: { opacity: 0, x: 32 },
    visible: { opacity: 1, x: 0, transition: { duration: DURATION.section, ease: EASE.out } },
  },
  // Scale In — for modals, hero cards
  scaleIn: {
    hidden: { opacity: 0, scale: 0.94 },
    visible: { opacity: 1, scale: 1, transition: { duration: DURATION.section, ease: EASE.out } },
  },
  // Staggered children container
  staggerContainer: (stagger = STAGGER.base, delayChildren = 0) => ({
    hidden: {},
    visible: {
      transition: { staggerChildren: stagger, delayChildren },
    },
  }),
  // Individual staggered child (pair with staggerContainer)
  staggerChild: {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: DURATION.base, ease: EASE.out } },
  },
};

// ─── Page transition variants ───────────────────────────────────────
export const PAGE_VARIANTS = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: DURATION.page, ease: EASE.out } },
  exit: { opacity: 0, transition: { duration: DURATION.page * 0.6, ease: EASE.in } },
};

// ─── Mobile entrance (smaller movement) ─────────────────────────────
export const MOBILE_VARIANTS = {
  fadeUp: {
    hidden: { opacity: 0, y: 12 },
    visible: { opacity: 1, y: 0, transition: { duration: DURATION.base, ease: EASE.out } },
  },
};

// ─── Viewport config for whileInView ────────────────────────────────
export const VIEWPORT = {
  once: true,
  amount: 0.15,
  margin: '0px 0px -60px 0px',
};

// ─── Reduced motion fallback ────────────────────────────────────────
// When prefers-reduced-motion is active, replace variant transitions
// with instant opacity-only changes.
export const REDUCED_VARIANTS = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.15 } },
};

// ─── Hover/Tap presets ──────────────────────────────────────────────
export const HOVER = {
  cardLift: { y: -6, transition: { duration: DURATION.base, ease: EASE.inOut } },
  iconNudge: { x: 4, transition: { duration: DURATION.fast, ease: EASE.inOut } },
  buttonPress: { scale: 0.96 },
  subtleScale: { scale: 1.03, transition: { duration: DURATION.base, ease: EASE.inOut } },
};

// ─── Helper: pick variants based on reduced motion ──────────────────
export function getVariants(variants, reduced) {
  if (reduced) return REDUCED_VARIANTS;
  return variants;
}