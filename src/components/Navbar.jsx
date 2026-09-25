import { Link, NavLink } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Menu, X, LogIn, LogOut, User, FileText, Heart, ClipboardList, LayoutDashboard, BookOpen, Compass, Vote, Trophy, Building2, Gavel, ShieldAlert, ScrollText, Network, Megaphone, BarChart3, Handshake, Rocket, ShieldCheck, Flame, Share2, Globe } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { DURATION, EASE, STAGGER } from '@/lib/motion';
import SiteLogo from '@/components/SiteLogo';
import useIsJudge from '@/hooks/useIsJudge';
import useIsHost from '@/hooks/useIsHost';
import RoleSwitcher from '@/components/layout/RoleSwitcher';
import { mainSiteUrl } from '@/lib/subdomainValidation';

// Public primary navigation — the only items visible to everyone.
const PUBLIC_NAV = [
  { to: '/challenges', label: 'Explore', icon: Compass },
  { to: '/challenges?phase=vote', label: 'Vote', icon: Vote },
  { to: '/hall-of-fame', label: 'Hall of Fame', icon: Trophy },
  { to: '/host-a-challenge', label: 'Host a Challenge', icon: Building2 },
  { to: '/sponsors-and-judges', label: '53 Sponsor & Judge', icon: Gavel },
];

// Challenge Engine — the admin section, only surfaced to admins.
const CHALLENGE_ENGINE = [
  { to: '/challenge-engine', label: 'Challenge Engine', icon: Rocket },
  { to: '/template-library', label: 'Template Library', icon: ScrollText },
  { to: '/corporate-intake-admin', label: 'Organisation Proposals', icon: Building2 },
  { to: '/compliance-gate', label: 'Moderation & Compliance', icon: ShieldCheck },
  { to: '/compliance-rules', label: 'Compliance Rules', icon: ScrollText },
  { to: '/judging', label: 'Judging', icon: Gavel },
  { to: '/vote-fraud', label: 'Voting Integrity', icon: ShieldAlert },
  { to: '/reporting', label: 'Reporting', icon: BarChart3 },
  { to: '/activity-report', label: 'Entry Activity', icon: BarChart3 },
  { to: '/marketing', label: 'Marketing', icon: Megaphone },
  { to: '/rate-card-admin', label: 'Rate Cards', icon: Handshake },
  { to: '/domain-management', label: 'Domain Management', icon: Globe },
  { to: '/audit', label: 'Audit', icon: Network },
  { to: '/ty', label: 'Planner', icon: Compass },
];

const ADMIN_TOOLS = [
  { to: '/dashboard', label: 'Admin Dashboard', icon: LayoutDashboard },
  ...CHALLENGE_ENGINE,
];

// Shared dropdown variants — opacity + small vertical movement
const dropdownVariants = {
  hidden: { opacity: 0, y: -8 },
  visible: { opacity: 1, y: 0, transition: { duration: DURATION.base, ease: EASE.out } },
  exit: { opacity: 0, y: -8, transition: { duration: DURATION.fast, ease: EASE.in } },
};

// Mobile menu item variants for staggered entrance
const mobileItemVariants = {
  hidden: { opacity: 0, x: -16 },
  visible: (i) => ({
    opacity: 1, x: 0,
    transition: { duration: DURATION.base, ease: EASE.out, delay: i * STAGGER.fast },
  }),
};

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { user, isAuthenticated, logout } = useAuth();
  const initial = (user?.full_name?.[0] || user?.email?.[0] || 'U').toUpperCase();
  const isAdmin = user?.role === 'admin' || user?.role === 'creator' || user?.is_admin === true;
  const isJudge = useIsJudge();
  const isHostUser = useIsHost();
  // Hosts see their workspace; everyone else sees the way to become one.
  const showHostWorkspace = isHostUser || isAdmin;
  const handleSignOut = () => { setMenuOpen(false); setOpen(false); logout(); };
  const roles = [
    ...(isAdmin ? ['admin'] : []),
    ...(isJudge ? ['judge'] : []),
    ...(isHostUser ? ['host'] : []),
    'user',
  ];

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e) => { if (e.key === 'Escape') setMenuOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  useEffect(() => {
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        setScrolled(window.scrollY > 20);
        ticking = false;
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // On a challenge subdomain the visitor is here for one challenge, so browsing
  // the whole catalogue in place makes no sense — Explore and Vote are replaced
  // by a single link back to the main site. `external` marks it as a plain <a>,
  // since a react-router Link would stay on the subdomain.
  const exploreMoreHref = mainSiteUrl('/challenges');
  // Only Explore and Vote are swapped for the main-site link: browsing the
  // catalogue in place makes no sense here. Hall of Fame, Host a Challenge and
  // Sponsor & Judge stay as normal in-app links — they work on a subdomain now
  // that <Routes> renders there.
  const publicNav = exploreMoreHref
    ? [
      { href: exploreMoreHref, label: 'Explore more', icon: Compass, external: true },
      ...PUBLIC_NAV.filter((it) => it.to !== '/challenges' && it.to !== '/challenges?phase=vote'),
    ]
    : PUBLIC_NAV;

  // Flatten mobile nav items for staggered animation
  const mobileItems = [
    ...publicNav.map((it) => ({ ...it, type: 'link' })),
  ];

  return (
    <motion.header initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: DURATION.section, ease: EASE.out }} className={`sticky top-0 z-50 backdrop-blur-xl transition-[background-color,box-shadow,border-color] duration-300 ${scrolled ? 'border-b border-border/70 bg-background/95 shadow-[0_8px_30px_-12px_rgba(0,0,0,0.45)]' : 'border-b border-white/5 bg-background/70'}`}>
      <nav aria-label="Main" className="mx-auto flex h-[68px] w-full max-w-[1240px] items-center justify-between px-4 md:h-[76px] md:px-5 lg:h-[88px] lg:px-6 xl:max-w-none xl:px-8 2xl:px-16">
        <Link to="/" aria-label="53 Challenges — home" className="-ml-1 mr-3 flex shrink-0 items-center rounded-xl p-1 text-foreground transition-opacity hover:opacity-85 lg:mr-5">
          <SiteLogo size={32} className="md:hidden" />
          <SiteLogo size={38} className="hidden md:inline-flex lg:hidden" />
          <SiteLogo size={46} className="hidden lg:inline-flex" />
        </Link>

        <div className="hidden items-center gap-1 rounded-full border border-white/5 bg-white/[0.04] p-1 lg:mx-4 lg:flex lg:flex-1 xl:mx-6">
          {publicNav.map((item) => (item.external ? (
            <a key={item.href} href={item.href}
              className="flex-1 whitespace-nowrap rounded-full px-3 py-2 text-center text-sm font-medium tracking-[0.01em] text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground xl:px-5 xl:text-[15px]">
              {item.label}
            </a>
          ) : (
            <NavLink key={item.to} to={item.to}
              className={({ isActive }) => `flex-1 whitespace-nowrap rounded-full px-3 py-2 text-center text-sm xl:text-[15px] xl:px-5 tracking-[0.01em] transition-colors ${isActive ? 'bg-primary/15 font-semibold text-foreground' : 'font-medium text-muted-foreground hover:bg-white/5 hover:text-foreground'}`}>
              {item.label}
            </NavLink>
          )))}
        </div>

        <div className="ml-auto flex items-center gap-3 shrink-0 md:gap-4">
          {isAuthenticated && <RoleSwitcher roles={roles} />}
          {isAuthenticated ? (
            <div className="relative">
              <button onClick={() => setMenuOpen((v) => !v)}
                className="grid h-10 w-10 place-items-center rounded-full bg-white/5 text-sm font-bold text-foreground ring-1 ring-border transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                aria-label={`Account menu for ${user?.full_name || user?.email || 'your account'}`} aria-haspopup="menu" aria-expanded={menuOpen}>
                {initial}
              </button>
              <AnimatePresence>
                {menuOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                    <motion.div
                      initial="hidden" animate="visible" exit="exit" variants={dropdownVariants}
                      className="absolute right-0 z-20 mt-2 w-64 overflow-y-auto rounded-xl border border-border bg-popover p-1 shadow-xl max-h-[80vh]"
                    >
                      <div className="px-3 py-2.5">
                        <p className="truncate text-sm font-semibold text-foreground">{user?.full_name || 'Account'}</p>
                        {user?.email && <p className="truncate text-xs text-muted-foreground">{user.email}</p>}
                      </div>
                      <div className="my-1 h-px bg-border" />
                      <Link to="/my-dashboard" onClick={() => setMenuOpen(false)} className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted hover:text-primary">
                        <LayoutDashboard className="h-4 w-4" /> My Dashboard
                      </Link>
                      <Link to="/profile" onClick={() => setMenuOpen(false)} className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted hover:text-primary">
                        <User className="h-4 w-4" /> My Profile
                      </Link>
                      <Link to="/my-progress" onClick={() => setMenuOpen(false)} className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted hover:text-primary">
                        <Flame className="h-4 w-4" /> My Progress
                      </Link>
                      <Link to="/my-entries" onClick={() => setMenuOpen(false)} className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted hover:text-primary">
                        <FileText className="h-4 w-4" /> My Entries
                      </Link>
                      <Link to="/my-votes" onClick={() => setMenuOpen(false)} className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted hover:text-primary">
                        <Heart className="h-4 w-4" /> My Votes
                      </Link>
                      <Link to="/my-promo" onClick={() => setMenuOpen(false)} className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted hover:text-primary">
                        <Share2 className="h-4 w-4" /> Promote My Entries
                      </Link>
                      <div className="my-1 h-px bg-border" />
                      <Link to="/my-requests" onClick={() => setMenuOpen(false)} className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted hover:text-primary">
                        <ClipboardList className="h-4 w-4" /> My Requests
                      </Link>
                      {showHostWorkspace && (
                        <Link to="/host-dashboard" onClick={() => setMenuOpen(false)} className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted hover:text-primary">
                          <Building2 className="h-4 w-4" /> My Host Workspace
                        </Link>
                      )}
                      {isJudge && (
                        <Link to="/judge" onClick={() => setMenuOpen(false)} className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted hover:text-primary">
                          <Gavel className="h-4 w-4" /> Judge Console
                        </Link>
                      )}
                      {isAdmin && (
                        <>
                          <div className="my-1 h-px bg-border" />
                          <p className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Challenge Engine</p>
                          {ADMIN_TOOLS.map((t) => (
                            <Link key={t.to} to={t.to} onClick={() => setMenuOpen(false)} className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted hover:text-primary">
                              <t.icon className="h-4 w-4" /> {t.label}
                            </Link>
                          ))}
                        </>
                      )}
                      <Link to="/manual" onClick={() => setMenuOpen(false)} className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted hover:text-primary">
                        <BookOpen className="h-4 w-4" /> Portal Manual
                      </Link>
                      <div className="my-1 h-px bg-border" />
                      <button onClick={handleSignOut} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted hover:text-primary">
                        <LogOut className="h-4 w-4" /> Sign out
                      </button>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          ) : (
            <Link to="/login" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
              <LogIn className="h-4 w-4" /> Sign in
            </Link>
          )}
          <Link to="/challenges" className="hidden h-9 items-center whitespace-nowrap rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-sm shadow-primary/25 transition-all hover:bg-primary/90 hover:shadow-md hover:shadow-primary/30 md:h-[38px] lg:h-10 sm:inline-flex">
            Enter a Challenge
          </Link>
          <button onClick={() => setOpen((v) => !v)} className="grid h-10 w-10 place-items-center rounded-full text-foreground hover:bg-muted lg:hidden" aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open}>
            <AnimatePresence mode="wait" initial={false}>
              {open ? (
                <motion.span key="x" initial={{ opacity: 0, rotate: -90 }} animate={{ opacity: 1, rotate: 0 }} exit={{ opacity: 0, rotate: 90 }} transition={{ duration: DURATION.fast, ease: EASE.inOut }}>
                  <X className="h-5 w-5" />
                </motion.span>
              ) : (
                <motion.span key="menu" initial={{ opacity: 0, rotate: 90 }} animate={{ opacity: 1, rotate: 0 }} exit={{ opacity: 0, rotate: -90 }} transition={{ duration: DURATION.fast, ease: EASE.inOut }}>
                  <Menu className="h-5 w-5" />
                </motion.span>
              )}
            </AnimatePresence>
          </button>
        </div>
      </nav>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: DURATION.base, ease: EASE.inOut }}
            className="overflow-hidden border-t border-border/70 bg-background lg:hidden"
          >
            <div className="mx-auto flex w-full max-w-[1240px] flex-col px-4 py-3">
              {mobileItems.map((item, i) => {
                if (item.type === 'label') {
                  return <motion.p key={`label-${i}`} custom={i} initial="hidden" animate="visible" variants={mobileItemVariants} className="px-3 pt-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{item.label}</motion.p>;
                }
                return (
                  <motion.div key={(item.to || item.href) + item.label} custom={i} initial="hidden" animate="visible" variants={mobileItemVariants}>
                    {item.external ? (
                      <a href={item.href} onClick={() => setOpen(false)}
                        className="flex min-h-[44px] items-center gap-2 rounded-lg px-3 text-sm font-medium text-foreground hover:bg-muted">
                        {item.icon && <item.icon className="h-4 w-4" />} {item.label}
                      </a>
                    ) : (
                      <NavLink to={item.to} onClick={() => setOpen(false)}
                        className={({ isActive }) => `flex min-h-[44px] items-center gap-2 rounded-lg px-3 text-sm ${isActive ? 'font-semibold text-primary' : 'font-medium text-foreground hover:bg-muted'}`}>
                        {item.icon && <item.icon className="h-4 w-4" />} {item.label}
                      </NavLink>
                    )}
                  </motion.div>
                );
              })}
              {isAuthenticated ? (
                <>
                  <motion.div custom={mobileItems.length} initial="hidden" animate="visible" variants={mobileItemVariants} className="my-1 h-px bg-border/50" />
                  <motion.div custom={mobileItems.length + 1} initial="hidden" animate="visible" variants={mobileItemVariants}>
                    <Link to="/my-dashboard" onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-lg px-3 py-3 text-sm font-medium text-foreground hover:bg-muted"><LayoutDashboard className="h-4 w-4" /> My Dashboard</Link>
                  </motion.div>
                  <motion.div custom={mobileItems.length + 2} initial="hidden" animate="visible" variants={mobileItemVariants}>
                    <Link to="/profile" onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-lg px-3 py-3 text-sm font-medium text-foreground hover:bg-muted"><User className="h-4 w-4" /> My Profile</Link>
                  </motion.div>
                  <motion.div custom={mobileItems.length + 3} initial="hidden" animate="visible" variants={mobileItemVariants}>
                    <Link to="/my-promo" onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-lg px-3 py-3 text-sm font-medium text-foreground hover:bg-muted"><Share2 className="h-4 w-4" /> Promote My Entries</Link>
                  </motion.div>
                  <motion.div custom={mobileItems.length + 4} initial="hidden" animate="visible" variants={mobileItemVariants}>
                    <Link to="/my-requests" onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-lg px-3 py-3 text-sm font-medium text-foreground hover:bg-muted"><ClipboardList className="h-4 w-4" /> My Requests</Link>
                  </motion.div>
                  <motion.div custom={mobileItems.length + 5} initial="hidden" animate="visible" variants={mobileItemVariants}>
                    {showHostWorkspace && (
                      <Link to="/host-dashboard" onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-lg px-3 py-3 text-sm font-medium text-foreground hover:bg-muted"><Building2 className="h-4 w-4" /> My Host Workspace</Link>
                    )}
                  </motion.div>
                  {isJudge && (
                    <motion.div custom={mobileItems.length + 6} initial="hidden" animate="visible" variants={mobileItemVariants}>
                      <Link to="/judge" onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-lg px-3 py-3 text-sm font-medium text-foreground hover:bg-muted"><Gavel className="h-4 w-4" /> Judge Console</Link>
                    </motion.div>
                  )}
                  {isAdmin && ADMIN_TOOLS.map((t, idx) => (
                    <motion.div key={t.to} custom={mobileItems.length + 3 + idx} initial="hidden" animate="visible" variants={mobileItemVariants}>
                      <Link to={t.to} onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-lg px-3 py-3 text-sm font-medium text-foreground hover:bg-muted"><t.icon className="h-4 w-4" /> {t.label}</Link>
                    </motion.div>
                  ))}
                  <motion.button key="signout" custom={mobileItems.length + 12} initial="hidden" animate="visible" variants={mobileItemVariants} onClick={handleSignOut} className="mt-2 flex items-center justify-center gap-2 rounded-xl border border-border bg-white/5 px-5 py-3 text-center text-sm font-bold text-foreground"><LogOut className="h-4 w-4" /> Sign out</motion.button>
                </>
              ) : (
                <motion.div custom={mobileItems.length} initial="hidden" animate="visible" variants={mobileItemVariants}>
                  <Link to="/login" onClick={() => setOpen(false)} className="mt-2 flex items-center justify-center gap-2 rounded-xl border border-border bg-white/5 px-5 py-3 text-center text-sm font-bold text-foreground"><LogIn className="h-4 w-4" /> Sign in</Link>
                </motion.div>
              )}
              <motion.div custom={mobileItems.length + 1} initial="hidden" animate="visible" variants={mobileItemVariants}>
                <Link to="/challenges" onClick={() => setOpen(false)} className="mt-2 flex min-h-[44px] items-center justify-center rounded-[11px] bg-primary px-5 text-center text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90">Enter a Challenge</Link>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
}