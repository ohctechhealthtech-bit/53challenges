import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useCategories } from '@/hooks/useCategories';

export default function About() {
  const { categories } = useCategories();
  return (
    <div className="container-tight py-12">
      <div className="mx-auto max-w-3xl text-center">
        <p className="text-sm font-semibold uppercase tracking-wider text-primary">About 53 Challenges</p>
        <h1 className="mt-2 font-heading text-4xl font-extrabold sm:text-5xl text-balance">Every talent deserves to be found.</h1>
        <p className="mt-4 text-lg text-muted-foreground">
          53 Challenges is Australia's creative discovery platform. We run year-round challenges across six creative categories, open to every Australian — from children to adults, in every state and territory.
        </p>
      </div>

      <div className="mt-14 grid gap-6 sm:grid-cols-3">
        {[
          { icon: '🎯', title: 'Our mission', body: 'To give every Australian creator a stage, an audience, and a pathway from passion to opportunity.' },
          { icon: '🗳️', title: 'Community voting', body: 'The nation decides. Community-powered voting surfaces the talent that truly resonates.' },
          { icon: '🏆', title: 'Real opportunities', body: 'Win prizes, get featured in our Hall of Fame, and unlock pathways across the 53 ecosystem.' },
        ].map((c) => (
          <div key={c.title} className="rounded-3xl border border-border bg-card p-7">
            <div className="text-4xl">{c.icon}</div>
            <h3 className="mt-4 font-heading text-xl font-bold">{c.title}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{c.body}</p>
          </div>
        ))}
      </div>

      <section className="mt-16">
        <h2 className="text-center font-heading text-3xl font-bold">Six categories. One stage.</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((c) => (
            <div key={c.slug} className="flex items-center gap-4 rounded-2xl border border-border bg-card p-5">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl text-2xl" style={{ backgroundColor: c.color + '22' }}>{c.icon}</div>
              <div>
                <h3 className="font-heading font-bold">{c.name}</h3>
                <p className="text-sm text-muted-foreground">{c.blurb}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-16 rounded-[2rem] bg-primary px-8 py-14 text-center text-primary-foreground sm:px-16">
        <h2 className="font-heading text-3xl font-extrabold sm:text-4xl text-balance">Your moment. Your talent. Your future.</h2>
        <p className="mx-auto mt-3 max-w-lg text-primary-foreground/80">Join thousands of creators and turn your passion into opportunity.</p>
        <Link to="/challenges" className="mt-7 inline-flex items-center gap-2 rounded-full bg-background px-7 py-3.5 text-sm font-bold text-foreground transition hover:scale-105">
          Join the Challenge Today <ArrowRight className="h-4 w-4" />
        </Link>
      </section>
    </div>
  );
}