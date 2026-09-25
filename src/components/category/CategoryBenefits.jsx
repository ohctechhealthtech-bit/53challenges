import RevealOnScroll from '@/components/home/RevealOnScroll';

export default function CategoryBenefits({ cat, accent }) {
  const items = cat.benefits || [];
  if (!items.length) return null;
  return (
    <section id="benefits" className="scroll-mt-24 border-t border-border bg-card/30">
      <div className="container-tight py-14">
        <RevealOnScroll className="mb-8 text-center">
          <p className="text-sm font-semibold uppercase tracking-wider" style={{ color: accent }}>Why take part</p>
          <h2 className="mt-1 font-heading text-2xl font-bold sm:text-3xl">Benefits of participating</h2>
        </RevealOnScroll>
        <RevealOnScroll stagger className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((b, i) => (
            <div key={i} className="card-lift rounded-2xl border border-border bg-card p-6">
              <div className="text-3xl">{b.icon}</div>
              <h3 className="mt-3 font-heading text-lg font-bold">{b.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{b.description}</p>
            </div>
          ))}
        </RevealOnScroll>
        <RevealOnScroll className="mt-8 rounded-2xl border p-6 text-center" >
          <div style={{ borderColor: accent + '44', backgroundColor: accent + '11' }}>
            <p className="text-sm font-semibold uppercase tracking-wider" style={{ color: accent }}>The 53 journey</p>
            <p className="mt-2 font-heading text-lg font-bold sm:text-xl">
              Learn through <span style={{ color: accent }}>53 Classes</span> → Compete in <span style={{ color: accent }}>53 Challenges</span> → Showcase in <span style={{ color: accent }}>53 Gallery</span>
            </p>
          </div>
        </RevealOnScroll>
      </div>
    </section>
  );
}