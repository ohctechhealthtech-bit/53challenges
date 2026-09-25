import { Link } from 'react-router-dom';
import { Gavel, Handshake, ArrowRight } from 'lucide-react';

const CARDS = [
  {
    icon: Gavel,
    title: 'Join as a judge',
    text: 'Share your expertise, score entries in your own time, and help creators get a fair, considered result.',
    to: '/become-a-judge',
    cta: 'Apply to judge',
  },
  {
    icon: Handshake,
    title: 'Join as a sponsor',
    text: 'Put your brand behind a challenge, category or season — with prizes, visibility and reporting.',
    to: '/become-a-sponsor',
    cta: 'Talk to us about sponsoring',
  },
];

export default function SJJoinCTA() {
  return (
    <section className="container-tight py-16">
      <h2 className="font-heading text-3xl font-extrabold sm:text-4xl">Be part of it</h2>
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {CARDS.map((c) => (
          <div key={c.title} className="card-lift flex flex-col rounded-2xl border border-border bg-card p-7">
            <span className="grid h-12 w-12 place-items-center rounded-xl bg-primary/15 text-primary">
              <c.icon className="h-6 w-6" />
            </span>
            <h3 className="mt-5 font-heading text-2xl font-extrabold">{c.title}</h3>
            <p className="mt-2 flex-1 text-muted-foreground">{c.text}</p>
            <Link to={c.to} className="mt-6 inline-flex w-fit items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground transition hover:bg-primary/90">
              {c.cta} <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        ))}
      </div>
    </section>
  );
}