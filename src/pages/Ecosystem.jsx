import { Link } from 'react-router-dom';
import { ArrowRight, ExternalLink } from 'lucide-react';
import { ECOSYSTEM, FUNNEL, CYCLE } from '@/lib/challenges-data';

export default function Ecosystem() {
  return (
    <div className="container-tight py-12">
      <div className="text-center">
        <p className="text-sm font-semibold uppercase tracking-wider text-primary">The 53 Ecosystem</p>
        <h1 className="mt-2 font-heading text-4xl font-extrabold sm:text-5xl">One platform. Endless possibilities.</h1>
        <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">Every product owns its identity but shares one account. Your profile, badges and certificates live across the whole 53 family.</p>
      </div>

      {/* Ecosystem grid */}
      <section className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {ECOSYSTEM.filter((e) => e.live).map((e) => {
          const Card = (
            <div className={`relative flex h-full flex-col overflow-hidden rounded-3xl border p-7 transition-all hover:-translate-y-1 hover:shadow-xl ${e.current ? 'border-primary bg-secondary' : 'border-border bg-card'}`}>
              <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full opacity-10" style={{ backgroundColor: e.color }} />
              <div className="grid h-14 w-14 place-items-center rounded-2xl text-3xl" style={{ backgroundColor: e.color + '22' }}>{e.icon}</div>
              <div className="mt-5 flex items-center gap-2">
                <span className="rounded-full px-2.5 py-0.5 text-xs font-bold text-white" style={{ backgroundColor: e.color }}>{e.verb}</span>
                {e.current && <span className="rounded-full bg-primary px-2.5 py-0.5 text-xs font-bold text-primary-foreground">You're here</span>}
                {!e.live && <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-bold text-muted-foreground">Coming soon</span>}
              </div>
              <h3 className="mt-3 font-heading text-xl font-bold">{e.name}</h3>
              <p className="mt-1 flex-1 text-sm text-muted-foreground">{e.blurb}</p>
              {e.url && (
                <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold" style={{ color: e.color }}>
                  Visit {e.name} <ExternalLink className="h-3.5 w-3.5" />
                </span>
              )}
            </div>
          );
          return e.url && !e.current ? (
            <a key={e.slug} href={e.url} target="_blank" rel="noopener noreferrer" className="block">{Card}</a>
          ) : (
            <div key={e.slug}>{Card}</div>
          );
        })}
      </section>

      {/* Funnel */}
      <section className="mt-20">
        <div className="text-center">
          <h2 className="font-heading text-3xl font-bold">Your journey to being found</h2>
          <p className="mt-2 text-muted-foreground">How a scroll on social becomes a lasting creator.</p>
        </div>
        <div className="mt-10 grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {FUNNEL.map((f, i) => (
            <div key={f.label} className="relative rounded-3xl border border-border bg-card p-6 text-center">
              <span className="absolute left-4 top-4 font-heading text-sm font-bold text-muted-foreground/50">{String(i + 1).padStart(2, '0')}</span>
              <div className="text-4xl">{f.icon}</div>
              <h3 className="mt-3 font-heading text-lg font-bold">{f.label}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{f.detail}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Cycle */}
      <section className="mt-16 overflow-hidden rounded-[2rem] border border-border bg-card sm:p-14">
        <div className="relative grad-soft-bg p-10 text-center">
          <h2 className="font-heading text-3xl font-bold">The 53 cycle</h2>
          <p className="mt-2 text-muted-foreground">A loop that keeps creators climbing.</p>
          <div className="mt-10 grid gap-6 sm:grid-cols-3 lg:grid-cols-5">
            {CYCLE.map((c) => (
              <div key={c.label} className="text-center">
                <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-white/5 text-3xl">{c.icon}</div>
                <h3 className="mt-3 font-heading text-lg font-bold">{c.label}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{c.detail}</p>
              </div>
            ))}
          </div>
          <div className="mt-10 text-center">
            <Link to="/challenges" className="inline-flex items-center gap-2 rounded-xl grad-bg px-7 py-3.5 text-sm font-bold text-white transition hover:-translate-y-0.5">
              Start the cycle — enter a challenge <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}