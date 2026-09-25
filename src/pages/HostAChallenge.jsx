import { Link } from 'react-router-dom';
import { Building2, ArrowRight, Calculator, Zap } from 'lucide-react';
import HostPackagesSection from '@/components/host/HostPackagesSection';
import HostHeroVideo from '@/components/host/HostHeroVideo';
import HostTrustStrip from '@/components/host/HostTrustStrip';
import HostHowItWorks from '@/components/host/HostHowItWorks';
import HostClosingCTA from '@/components/host/HostClosingCTA';

export default function HostAChallenge() {
  return (
    <div>
      <section className="relative overflow-hidden gradient-hero border-b border-border">
        <div className="container-tight grid items-center gap-10 py-16 lg:grid-cols-2 lg:gap-14 lg:py-20">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs font-semibold text-muted-foreground">
              <Building2 className="h-3.5 w-3.5 text-accent" /> For organisations
            </div>
            <h1 className="mt-5 font-heading text-4xl font-extrabold text-balance sm:text-5xl">
              Run a challenge your community will <span className="grad-text">talk about.</span>
            </h1>
            <p className="mt-4 max-w-xl text-lg text-muted-foreground">
              Meaningful engagement — without the admin. We handle compliance, judging, promotion and
              reporting end to end.
            </p>
            <p className="mt-5 inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-3.5 py-1.5 text-xs font-bold text-primary">
              <Zap className="h-3.5 w-3.5" /> No tech setup. Live in days.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link to="/host-start" className="inline-flex items-center gap-2 rounded-full grad-bg px-7 py-3.5 text-base font-bold text-white transition hover:-translate-y-0.5">
                Start a Challenge Proposal <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/pricing-calculator" className="inline-flex items-center gap-2 rounded-full border border-border bg-white/5 px-6 py-3.5 text-sm font-bold text-foreground transition hover:border-primary hover:text-primary">
                <Calculator className="h-4 w-4" /> Estimate your cost
              </Link>
              <Link to="/challenges" className="inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold text-primary transition hover:underline">
                Browse live challenges
              </Link>
            </div>
          </div>

          <HostHeroVideo />
        </div>
      </section>

      <HostTrustStrip />

      <HostHowItWorks />

      <div className="scroll-mt-24">
        <HostPackagesSection />
      </div>

      <HostClosingCTA />
    </div>
  );
}