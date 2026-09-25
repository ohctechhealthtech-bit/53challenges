import RevealOnScroll from '@/components/home/RevealOnScroll';

export default function CategoryWorkTypes({ cat, accent }) {
  const items = cat.work_types || [];
  if (!items.length) return null;
  return (
    <section id="work" className="scroll-mt-24 border-t border-border bg-card/30">
      <div className="container-tight py-14">
        <RevealOnScroll className="mb-8 text-center">
          <p className="text-sm font-semibold uppercase tracking-wider" style={{ color: accent }}>What's included</p>
          <h2 className="mt-1 font-heading text-2xl font-bold sm:text-3xl">What kind of work is included?</h2>
        </RevealOnScroll>
        <RevealOnScroll stagger className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((w, i) => (
            <div key={i} className="card-lift rounded-2xl border border-border bg-card p-4 text-center">
              <div className="text-2xl">{w.icon || '•'}</div>
              <p className="mt-2 text-sm font-semibold">{w.label}</p>
            </div>
          ))}
        </RevealOnScroll>
      </div>
    </section>
  );
}