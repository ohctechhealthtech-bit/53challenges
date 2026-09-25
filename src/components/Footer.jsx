import { Link } from 'react-router-dom';
import { Instagram, Facebook, Youtube } from 'lucide-react';
import { motion } from 'framer-motion';
import { SITE_CONFIG, TRUST_PAGES } from '@/lib/siteConfig';
import SiteLogo from '@/components/SiteLogo';

export default function Footer() {
  const cols = [
    {
      heading: 'How It Works',
      links: [
        { label: 'How It Works', to: '/about' },
        { label: 'Competition Rules', to: '/competition-rules' },
        { label: 'Safety & Wellbeing', to: '/safety-and-wellbeing' },
      ],
    },
    {
      heading: 'Legal',
      links: TRUST_PAGES,
    },
    {
      heading: 'Get Involved',
      links: [
        { label: 'Enter a Challenge', to: '/challenges' },
        { label: 'Become a Judge', to: '/become-a-judge' },
        { label: 'For Hosts', to: '/host-start' },
        { label: 'Leaderboard', to: '/leaderboard' },
      ],
    },
  ];
  return (
    <footer className="border-t border-border bg-secondary text-foreground">
      <div className="container-tight py-14">
        <div className="grid gap-10 md:grid-cols-4">
          <div>
            <SiteLogo size={28} />
          </div>
          {cols.map((c) => (
            <div key={c.heading}>
              <h4 className="font-heading text-sm font-semibold uppercase tracking-wider text-muted-foreground">{c.heading}</h4>
              <ul className="mt-4 space-y-2 text-sm">
                {c.links.map((l) => (
                  <li key={l.label}><Link to={l.to} className="text-muted-foreground transition-colors hover:text-primary">{l.label}</Link></li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-border pt-6 text-xs text-muted-foreground/70 sm:flex-row">
          <div className="flex items-center gap-3">
            <motion.a href={SITE_CONFIG.social.instagram} target="_blank" rel="noopener noreferrer" aria-label="Instagram" whileHover={{ y: -3 }} className="grid h-9 w-9 place-items-center rounded-full border border-border bg-white/5 text-muted-foreground transition-colors hover:border-primary hover:text-primary"><Instagram className="h-4 w-4" /></motion.a>
            <motion.a href={SITE_CONFIG.social.facebook} target="_blank" rel="noopener noreferrer" aria-label="Facebook" whileHover={{ y: -3 }} className="grid h-9 w-9 place-items-center rounded-full border border-border bg-white/5 text-muted-foreground transition-colors hover:border-primary hover:text-primary"><Facebook className="h-4 w-4" /></motion.a>
            <motion.a href={SITE_CONFIG.social.youtube} target="_blank" rel="noopener noreferrer" aria-label="YouTube" whileHover={{ y: -3 }} className="grid h-9 w-9 place-items-center rounded-full border border-border bg-white/5 text-muted-foreground transition-colors hover:border-primary hover:text-primary"><Youtube className="h-4 w-4" /></motion.a>
          </div>
          <p className="flex items-center gap-2 font-semibold text-foreground">🇦🇺 Proudly Australian</p>
          <p>© {new Date().getFullYear()} {SITE_CONFIG.brand}</p>
        </div>
      </div>
    </footer>
  );
}