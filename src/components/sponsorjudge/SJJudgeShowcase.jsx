import { Award, ShieldCheck, Scale, Users } from 'lucide-react';

const POINTS = [
  { icon: Award, title: 'Recognised experts', text: 'Artists, makers, performers, writers and photographers who work in the field every day.' },
  { icon: ShieldCheck, title: 'Blind, fair scoring', text: 'Judges score entries against a published rubric, without seeing who made them.' },
  { icon: Scale, title: 'Conflicts declared', text: 'Every panel member declares conflicts before scoring — results you can trust.' },
  { icon: Users, title: 'Panels, not one voice', text: 'Multiple judges score each entry, so no single opinion decides a winner.' },
];

export default function SJJudgeShowcase() {
  return (
    <section className="container-tight py-16">
      <h2 className="font-heading text-3xl font-extrabold sm:text-4xl">Our judging panel</h2>
      <p className="mt-3 max-w-2xl text-muted-foreground">
        Judging is the heart of a credible challenge. Here's how our panels work — and what you'd be
        part of if you join us.
      </p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {POINTS.map((p) => (
          <div key={p.title} className="card-lift rounded-2xl border border-border bg-card p-6">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary/15 text-primary">
              <p.icon className="h-5 w-5" />
            </span>
            <h3 className="mt-4 font-heading text-lg font-bold">{p.title}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{p.text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}