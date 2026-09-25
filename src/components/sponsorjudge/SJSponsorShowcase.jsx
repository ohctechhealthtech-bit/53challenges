import { Megaphone, Trophy, BarChart3, Heart } from 'lucide-react';

const BENEFITS = [
  { icon: Megaphone, title: 'Real audience reach', text: 'Your brand appears on the challenge page, entries, voting pages and winner announcements.' },
  { icon: Trophy, title: 'Prizes with meaning', text: 'Back a prize, a category or a whole season — and be part of the moment someone wins.' },
  { icon: BarChart3, title: 'Reporting you can use', text: 'Entries, votes, reach and audience insight reported back to you after every challenge.' },
  { icon: Heart, title: 'Community goodwill', text: 'Support creativity across schools, clubs and communities — not just advertising space.' },
];

export default function SJSponsorShowcase() {
  return (
    <section className="border-y border-border/60 bg-white/[0.02] py-16">
      <div className="container-tight">
        <h2 className="font-heading text-3xl font-extrabold sm:text-4xl">Our sponsors</h2>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          Sponsors make prizes, events and opportunities possible. Here's what sponsoring a 53
          Challenge looks like.
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {BENEFITS.map((b) => (
            <div key={b.title} className="flex gap-4 rounded-2xl border border-border bg-card p-6">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gold/15 text-gold">
                <b.icon className="h-5 w-5" />
              </span>
              <div>
                <h3 className="font-heading text-lg font-bold">{b.title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{b.text}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}