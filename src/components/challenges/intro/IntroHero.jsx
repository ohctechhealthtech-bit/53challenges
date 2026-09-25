import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Users, CalendarDays, Heart } from 'lucide-react';
import { format } from 'date-fns';
import IntroStatusCard from './IntroStatusCard';
import { mainSiteUrl } from '@/lib/subdomainValidation';

const fmt = (d) => { try { return format(new Date(d), 'd MMM yyyy'); } catch { return ''; } };

export default function IntroHero({
  challenge, intro, accent, cat, entriesCount, totalVotes,
  statusLabel, deadline, prize, audience, primaryCta, secondaryCta, phase,
}) {
  const headline = intro.headline || challenge.theme || challenge.title;
  const tagline = intro.tagline || challenge.brief || '';
  const hero = intro.hero_image || challenge.cover_image || '';
  // '' on the apex, so the normal in-app back link is used there.
  const mainSiteHref = mainSiteUrl('/');

  return (
    <div className="relative overflow-hidden" style={{ backgroundColor: cat.color }}>
      {hero && <img src={hero} alt="" className="absolute inset-0 h-full w-full object-cover opacity-45" />}
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/60 to-black/40" />
      <div className="container-tight relative py-14 text-white sm:py-16">
        {/* On a challenge subdomain there is no catalogue to go "back" to —
            the visitor arrived here directly — so send them to the main site
            instead of a list this host does not serve. */}
        {mainSiteHref ? (
          <a href={mainSiteHref} className="mb-6 inline-flex items-center gap-1.5 text-sm text-white/80 hover:text-white">
            Get more <ArrowRight className="h-4 w-4" />
          </a>
        ) : (
          <Link to="/challenges" className="mb-6 inline-flex items-center gap-1.5 text-sm text-white/80 hover:text-white">
            <ArrowLeft className="h-4 w-4" /> All challenges
          </Link>
        )}
        <div className="lg:flex lg:items-start lg:justify-between lg:gap-10">
          <motion.div
            initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="min-w-0 max-w-2xl"
          >
            <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold backdrop-blur ${accent.soft} text-white ring-1 ring-white/25`}>
              {cat.icon} {cat.name}
            </span>
            <h1 className="mt-5 font-heading text-4xl font-extrabold leading-tight sm:text-5xl">{headline}</h1>
            {tagline && <p className="mt-4 text-base text-white/90">{tagline}</p>}
            {audience && <p className="mt-3 text-sm font-semibold text-white/75">Audience: {audience}</p>}

            <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm text-white/90 [text-shadow:0_1px_3px_rgba(0,0,0,0.6)]">
              <span className="flex items-center gap-1.5"><Users className="h-4 w-4" /> {entriesCount} creator{entriesCount === 1 ? '' : 's'} have entered</span>
              <span className="flex items-center gap-1.5"><Heart className="h-4 w-4" /> {totalVotes} vote{totalVotes === 1 ? '' : 's'}</span>
              {challenge.submission_ends_at && (
                <span className="flex items-center gap-1.5"><CalendarDays className="h-4 w-4" /> Entries close {fmt(challenge.submission_ends_at)}</span>
              )}
            </div>

          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className="mt-8 flex shrink-0 lg:mt-0"
          >
            <IntroStatusCard
              statusLabel={statusLabel}
              deadline={deadline}
              prize={prize}
              entriesCount={entriesCount}
              cta={primaryCta}
              phase={phase}
            />
          </motion.div>
        </div>
      </div>
    </div>
  );
}