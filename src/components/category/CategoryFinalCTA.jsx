import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import RevealOnScroll from '@/components/home/RevealOnScroll';

export default function CategoryFinalCTA({ cat, accent }) {
  return (
    <section className="border-t border-border">
      <div className="container-tight py-16">
        <RevealOnScroll>
          <div className="relative overflow-hidden rounded-3xl border border-border p-10 text-center sm:p-14" style={{ background: `radial-gradient(80% 120% at 50% 0%, ${accent}26, transparent 70%)` }}>
            <div className="text-5xl">{cat.icon}</div>
            <h2 className="mt-4 font-heading text-3xl font-extrabold sm:text-4xl">Ready to enter {cat.name}?</h2>
            <p className="mx-auto mt-3 max-w-xl text-base text-muted-foreground">{cat.tagline} Pick a challenge, prepare your work, and share it with the 53 community.</p>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <Link to="/challenges" className="btn-glow inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-bold text-white" style={{ backgroundColor: accent }}>
                View Challenges <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/register" className="inline-flex items-center gap-2 rounded-xl border border-border bg-white/5 px-6 py-3 text-sm font-bold">
                Create an account
              </Link>
            </div>
          </div>
        </RevealOnScroll>
      </div>
    </section>
  );
}