/**
 * Three-step "how hosting works" band — calm, low effort, ending on a green
 * completion state so the journey reads as finished, not started.
 */
import { Check } from 'lucide-react';

const STEPS = [
  { title: 'Apply in minutes', text: 'Answer a few questions about your challenge — takes about 3 minutes.' },
  { title: 'We set it up', text: 'Our team reviews your proposal, handles compliance and builds your challenge page.' },
  { title: 'Go live', text: 'Your challenge is live. Entries come in, we manage judging and reporting.', done: true },
];

export default function HostHowItWorks() {
  return (
    <section className="container-tight py-14">
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-xs font-bold uppercase tracking-widest text-primary">How it works</p>
        <h2 className="mt-2 font-heading text-3xl font-extrabold sm:text-4xl">Three steps to launch</h2>
      </div>

      <ol className="mt-10 grid gap-6 md:grid-cols-3">
        {STEPS.map((s, i) => (
          <li key={s.title} className="relative rounded-2xl border border-border bg-card/60 p-6">
            {i < STEPS.length - 1 && (
              <span
                className={`absolute left-full top-12 hidden h-px w-6 md:block ${
                  i === 1 ? 'bg-success' : 'bg-primary'
                }`}
                aria-hidden="true"
              />
            )}
            <span
              className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-extrabold text-white ${
                s.done ? 'bg-success' : 'bg-primary'
              }`}
              aria-hidden="true"
            >
              {s.done ? <Check className="h-5 w-5" /> : i + 1}
            </span>
            <h3 className="mt-4 font-heading text-lg font-bold">
              {s.done ? s.title : `Step ${i + 1}: ${s.title}`}
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">{s.text}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}