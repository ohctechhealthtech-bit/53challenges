import { Trophy, Calendar, ArrowRight, ChevronDown, Users } from 'lucide-react';
import { Image } from '@/components/ui/image';

const FALLBACK_HERO =
  'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?auto=format&fit=crop&w=1600&q=80';

export default function CategoryHero({ cat, accent, challengeCount = 0, prizeTotal = 0, nextClosing = null }) {
  const scrollToChallenges = () => document.getElementById('challenges')?.scrollIntoView({ behavior: 'smooth' });
  const scrollToHow = () => document.getElementById('how')?.scrollIntoView({ behavior: 'smooth' });

  const heroImg = cat.hero_image || FALLBACK_HERO;

  return (
    <section id="overview" className="relative scroll-mt-24 overflow-hidden">
      {/* Background image + overlay */}
      <div className="absolute inset-0 -z-10">
        <Image src={heroImg} alt={`${cat.name} hero`} className="h-full w-full" fittingType="fill" />
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(90deg, rgba(8,10,16,0.88) 0%, rgba(8,10,16,0.55) 45%, rgba(8,10,16,0.25) 100%), radial-gradient(80% 100% at 0% 0%, ${accent}33, transparent 60%)`,
          }}
        />
      </div>

      <div className="container-tight flex min-h-[60vh] flex-col justify-center py-16 sm:py-20 lg:py-28">
        <div className="max-w-2xl">
          <div className="flex items-center gap-3">
            <span className="grid h-12 w-12 place-items-center rounded-xl text-2xl" style={{ backgroundColor: accent + '22' }}>
              {cat.icon}
            </span>
            <p className="text-xs font-bold uppercase tracking-[0.2em]" style={{ color: accent }}>
              {cat.tagline || `${cat.name} challenge`}
            </p>
          </div>

          <h1 className="mt-5 font-heading text-4xl font-extrabold leading-[1.05] tracking-tight text-white sm:text-5xl lg:text-6xl">
            {cat.name}
          </h1>

          {cat.full_description && (
            <p className="mt-5 max-w-xl text-base text-slate-200 sm:text-lg">{cat.full_description}</p>
          )}

          {/* Meta row */}
          <div className="mt-7 flex flex-wrap items-center gap-x-7 gap-y-3">
            {prizeTotal > 0 && (
              <Meta icon={Trophy} accent={accent} label={`${prizeTotal.toLocaleString()} prize pool`} prefix="$" />
            )}
            {nextClosing && (
              <Meta icon={Calendar} accent={accent} label={`Entries close ${nextClosing}`} />
            )}
            {challengeCount > 0 && (
              <Meta icon={Users} accent={accent} label={`${challengeCount} active ${challengeCount === 1 ? 'challenge' : 'challenges'}`} />
            )}
          </div>

          {/* CTAs */}
          <div className="mt-8 flex flex-wrap gap-3">
            <button
              onClick={scrollToChallenges}
              className="btn-glow inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-bold text-white shadow-lg transition hover:-translate-y-0.5"
              style={{ backgroundColor: accent }}
            >
              Enter Challenge <ArrowRight className="h-4 w-4" />
            </button>
            <button
              onClick={scrollToHow}
              className="inline-flex items-center gap-2 rounded-xl border border-white/30 bg-white/5 px-6 py-3 text-sm font-bold text-white backdrop-blur-sm transition hover:bg-white/15"
            >
              How It Works <ChevronDown className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function Meta({ icon: Icon, accent, label, prefix = '' }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm font-semibold text-white">
      <span className="grid h-8 w-8 place-items-center rounded-lg" style={{ backgroundColor: accent + '22', color: accent }}>
        <Icon className="h-4 w-4" />
      </span>
      {prefix}{label}
    </span>
  );
}