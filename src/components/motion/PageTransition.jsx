import { motion } from 'framer-motion';
import { PAGE_VARIANTS } from '@/lib/motion';

/**
 * Wraps page content with a smooth fade transition for route changes.
 * Used inside Layout's <Outlet /> via AnimatePresence in App.jsx.
 * Keeps transitions short to avoid delaying content or blocking interaction.
 */
export default function PageTransition({ children }) {
  return (
    <motion.div
      initial={PAGE_VARIANTS.initial}
      animate={PAGE_VARIANTS.animate}
      exit={PAGE_VARIANTS.exit}
    >
      {children}
    </motion.div>
  );
}