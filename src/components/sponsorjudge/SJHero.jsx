import { Link } from 'react-router-dom';
import { Gavel, Handshake } from 'lucide-react';

export default function SJHero() {
  return (
    <section className="relative overflow-hidden border-b border-border/60 gradient-hero">
      <div className="container-tight py-16 sm:py-24">
        <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-semibold text-muted-foreground">
          53 Sponsor &amp; Judge
        </span>
        <h1 className="mt-5 max-w-3xl font-heading text-4xl font-extrabold leading-tight text-balance sm:text-5xl">
          The people and brands behind every <span className="grad-text">53 Challenges</span> winner
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
          Our judges bring real craft and fairness to every result. Our sponsors put the prizes,
          opportunities and spotlight behind them. Meet them here — and join them.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link to="/become-a-judge" className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/25 transition hover:-translate-y-0.5">
            <Gavel className="h-4 w-4" /> Become a judge
          </Link>
          <Link to="/become-a-sponsor" className="inline-flex items-center gap-2 rounded-xl border border-border bg-white/5 px-6 py-3 text-sm font-bold text-foreground transition hover:bg-white/10">
            <Handshake className="h-4 w-4" /> Become a sponsor
          </Link>
        </div>
      </div>
    </section>
  );
}