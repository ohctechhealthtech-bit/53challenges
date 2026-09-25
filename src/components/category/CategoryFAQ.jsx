import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import RevealOnScroll from '@/components/home/RevealOnScroll';

export default function CategoryFAQ({ cat, accent }) {
  const items = cat.faq_items || [];
  const [open, setOpen] = useState(0);
  if (!items.length) return null;
  return (
    <section className="border-t border-border bg-card/30">
      <div className="container-tight py-14">
        <RevealOnScroll className="mb-8 text-center">
          <p className="text-sm font-semibold uppercase tracking-wider" style={{ color: accent }}>FAQ</p>
          <h2 className="mt-1 font-heading text-2xl font-bold sm:text-3xl">Category FAQ</h2>
        </RevealOnScroll>
        <RevealOnScroll className="mx-auto max-w-3xl space-y-3">
          {items.map((f, i) => {
            const on = open === i;
            return (
              <div key={i} className="overflow-hidden rounded-2xl border border-border bg-card">
                <button onClick={() => setOpen(on ? -1 : i)} className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left">
                  <span className="font-heading text-sm font-bold sm:text-base">{f.question}</span>
                  <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${on ? 'rotate-180' : ''}`} style={{ color: accent }} />
                </button>
                {on && <p className="px-5 pb-5 text-sm text-muted-foreground">{f.answer}</p>}
              </div>
            );
          })}
        </RevealOnScroll>
      </div>
    </section>
  );
}