/**
 * Single closing band for /host-a-challenge — merges the old "custom proposal"
 * and "curated library" cards into one clear next step.
 */
import { Link } from 'react-router-dom';
import { ArrowRight, Calculator, Clock } from 'lucide-react';

export default function HostClosingCTA() {
  return (
    <section className="container-tight py-16">
      <div className="rounded-3xl border border-border bg-card/60 p-8 text-center sm:p-12">
        <h2 className="font-heading text-3xl font-extrabold sm:text-4xl">
          Ready when you are
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
          Tell us about your idea — or pick a package above. We assess the concept, recommend the
          right format and judging model, and come back with scope and pricing before anything
          goes live.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link to="/host-start" className="inline-flex items-center gap-2 rounded-full grad-bg px-7 py-3.5 text-base font-bold text-white transition hover:-translate-y-0.5">
            Start a Challenge Proposal <ArrowRight className="h-4 w-4" />
          </Link>
          <Link to="/pricing-calculator" className="inline-flex items-center gap-2 rounded-full border border-border bg-white/5 px-6 py-3.5 text-sm font-bold text-foreground transition hover:border-primary hover:text-primary">
            <Calculator className="h-4 w-4" /> Estimate your cost
          </Link>
        </div>
        <p className="mt-6 inline-flex items-center gap-2 rounded-full border border-border bg-white/5 px-4 py-2 text-xs font-semibold text-muted-foreground">
          <Clock className="h-3.5 w-3.5" /> Prefer a ready-made format? Our curated challenge library is coming soon.
        </p>
      </div>
    </section>
  );
}