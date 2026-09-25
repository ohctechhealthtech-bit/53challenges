import { Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import Navbar from './Navbar';
import Footer from './Footer';
import ScrollToTop from './ScrollToTop';
import PageTransition from '@/components/motion/PageTransition';
import ThemeApplier from '@/components/ThemeApplier';

// `children` is used by the challenge-subdomain page, which renders outside the
// router's route tree and would otherwise get no navbar or footer. Route usage
// passes nothing and keeps using <Outlet />.
export default function Layout({ children }) {
  const location = useLocation();
  return (
    <div className="flex min-h-screen flex-col">
      <ThemeApplier />
      <ScrollToTop />
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:text-primary-foreground"
      >
        Skip to main content
      </a>
      <Navbar />
      <main id="main-content" tabIndex={-1} className="flex-1">
        <AnimatePresence mode="wait">
          <PageTransition key={location.pathname}>
            {children ?? <Outlet />}
          </PageTransition>
        </AnimatePresence>
      </main>
      <Footer />
    </div>
  );
}