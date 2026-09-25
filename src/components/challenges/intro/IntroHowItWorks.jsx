import { Palette, Send, Heart, Gavel, Crown } from 'lucide-react';

const STEPS = [
  { icon: Palette, title: 'Create', text: 'Make your entry' },
  { icon: Send, title: 'Submit', text: 'Enter your work online' },
  { icon: Heart, title: 'Voting', text: 'Community votes for favourites' },
  { icon: Gavel, title: 'Judging', text: 'Finalists judged by experts' },
  { icon: Crown, title: 'Winner', text: 'Winners announced' },
];

/** Step-by-step journey from creating to winning. */
export default function IntroHowItWorks() {
  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <h2 className="font-heading text-lg font-bold">How it works</h2>
      <ol className="mt-5 grid grid-cols-5 gap-2">
        {STEPS.map((s, i) => (
          <li key={s.title}>
            <div className="text-center">
              <span className={`mx-auto grid h-11 w-11 place-items-center rounded-full ${i === STEPS.length - 1 ? 'bg-amber-500/20 text-amber-400' : 'bg-purple-500/15 text-purple-400'}`}>
                <s.icon className="h-5 w-5" />
              </span>
              <p className="mt-2 text-xs font-bold">{i + 1}. {s.title}</p>
              <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{s.text}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}