import RevealOnScroll from '@/components/home/RevealOnScroll';

const STEPS = [
  'Select a challenge.',
  'Review its eligibility and rules.',
  'Prepare your work.',
  'Upload and submit your entry.',
  'Wait for moderation.',
  'Receive votes or judging scores.',
  'View the results.',
  'Showcase eligible work in 53 Gallery.',
];

const PRIZE_TYPES = ['Cash prizes', 'Gift cards', 'Creative equipment', 'Materials', 'Class access', 'Mentoring', 'Certificates', 'Digital badges', 'Gallery features', 'Finalist recognition', "People's Choice awards"];

export default function CategoryProcess({ cat, accent }) {
  const formats = cat.challenge_formats || [];
  return (
    <section id="how" className="scroll-mt-24 border-t border-border bg-card/30">
      <div className="container-tight py-14">
        <RevealOnScroll className="mb-8 text-center">
          <p className="text-sm font-semibold uppercase tracking-wider" style={{ color: accent }}>Formats & process</p>
          <h2 className="mt-1 font-heading text-2xl font-bold sm:text-3xl">Challenge & submission formats</h2>
        </RevealOnScroll>

        {formats.length > 0 && (
          <RevealOnScroll stagger className="mb-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {formats.map((f, i) => (
              <div key={i} className="card-lift flex items-start gap-3 rounded-2xl border border-border bg-card p-5">
                <span className="text-2xl">{f.icon}</span>
                <div>
                  <h3 className="font-heading text-base font-bold">{f.label}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{f.description}</p>
                </div>
              </div>
            ))}
          </RevealOnScroll>
        )}

        <div className="grid gap-8 lg:grid-cols-2">
          <RevealOnScroll variant="left">
            <h3 className="font-heading text-xl font-bold">Prizes & recognition</h3>
            <ul className="mt-4 grid gap-2 sm:grid-cols-2">
              {PRIZE_TYPES.map((p, i) => (
                <li key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: accent }} /> {p}
                </li>
              ))}
            </ul>
            <p className="mt-4 text-xs text-muted-foreground">Total prize value is only shown when it can be calculated from real published challenge records.</p>
          </RevealOnScroll>
          <RevealOnScroll variant="right">
            <h3 className="font-heading text-xl font-bold">How challenges work</h3>
            <ol className="mt-4 space-y-3">
              {STEPS.map((s, i) => (
                <li key={i} className="flex items-center gap-3">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold" style={{ backgroundColor: accent, color: '#fff' }}>{i + 1}</span>
                  <span className="text-sm font-medium">{s}</span>
                </li>
              ))}
            </ol>
          </RevealOnScroll>
        </div>
      </div>
    </section>
  );
}