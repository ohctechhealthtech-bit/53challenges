/**
 * Qualitative trust band under the host hero. Deliberately no participant or
 * organisation counts — only claims we can stand behind.
 */
import { ShieldCheck, Gavel, Megaphone, BarChart3 } from 'lucide-react';

const POINTS = [
  { icon: ShieldCheck, label: 'Compliance handled', text: 'Terms, permits and consent to Australian trade-promotion requirements.' },
  { icon: Gavel, label: 'Judging built in', text: 'Judge panels, rubrics, blind scoring and vote-integrity controls.' },
  { icon: Megaphone, label: 'Promotion included', text: 'Campaign assets and entrant support from launch to close.' },
  { icon: BarChart3, label: 'Reporting after', text: 'A clear results and engagement report you can share internally.' },
];

export default function HostTrustStrip() {
  return (
    <section className="border-b border-border bg-card/40">
      <div className="container-tight py-10">
        <p className="text-center text-xs font-bold uppercase tracking-widest text-primary">
          What you get in every package
        </p>
        <div className="mt-7 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {POINTS.map((p) => (
            <div key={p.label} className="rounded-2xl border border-border bg-card/60 p-5">
              <p.icon className="h-6 w-6 text-accent" aria-hidden="true" />
              <h3 className="mt-3 font-heading text-base font-bold">{p.label}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{p.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}