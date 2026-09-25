import RevealOnScroll from '@/components/home/RevealOnScroll';

export default function CategoryLearning({ cat, accent }) {
  const items = cat.learning_outcomes || [];
  if (!items.length) return null;
  return (
    <section className="border-t border-border">
      <div className="container-tight py-14">
        <RevealOnScroll className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-wider" style={{ color: accent }}>Learning</p>
          <h2 className="mt-1 font-heading text-2xl font-bold sm:text-3xl">What can participants learn?</h2>
        </RevealOnScroll>
        <RevealOnScroll stagger className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((s, i) => (
            <div key={i} className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-bold" style={{ backgroundColor: accent + '22', color: accent }}>{i + 1}</span>
              <span className="text-sm font-medium">{s}</span>
            </div>
          ))}
        </RevealOnScroll>
      </div>
    </section>
  );
}