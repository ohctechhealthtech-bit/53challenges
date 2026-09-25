import RevealOnScroll from '@/components/home/RevealOnScroll';
import { Info } from 'lucide-react';

export default function CategoryEligibility({ cat, accent }) {
  const audience = cat.audience_types || [];
  return (
    <section id="eligibility" className="scroll-mt-24 border-t border-border">
      <div className="container-tight py-14">
        <RevealOnScroll className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-wider" style={{ color: accent }}>Eligibility</p>
          <h2 className="mt-1 font-heading text-2xl font-bold sm:text-3xl">Who can participate?</h2>
        </RevealOnScroll>
        {audience.length > 0 && (
          <RevealOnScroll stagger className="mb-8 flex flex-wrap gap-2">
            {audience.map((a, i) => (
              <span key={i} className="rounded-full border border-border bg-card px-4 py-2 text-sm font-medium">{a}</span>
            ))}
          </RevealOnScroll>
        )}
        <RevealOnScroll>
          <div className="flex gap-3 rounded-2xl border p-5" style={{ borderColor: accent + '44', backgroundColor: accent + '11' }}>
            <Info className="h-5 w-5 shrink-0" style={{ color: accent }} />
            <p className="text-sm text-muted-foreground">{cat.eligibility_guidance}</p>
          </div>
        </RevealOnScroll>
      </div>
    </section>
  );
}