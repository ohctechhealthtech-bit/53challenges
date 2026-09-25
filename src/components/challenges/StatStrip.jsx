import RevealOnScroll from '@/components/home/RevealOnScroll';

const STATS = [
  { icon: '🏆', label: '$5,000+', sub: 'Prize Pool' },
  { icon: '⭐', label: '53', sub: 'Challenges' },
  { icon: '📍', label: '8', sub: 'States & Territories' },
  { icon: '👥', label: '100+', sub: 'Skills & Interests' },
  { icon: '💚', label: 'Community', sub: 'Powered Voting' },
  { icon: '📅', label: 'Year-Round', sub: 'Opportunities' },
];

export default function StatStrip() {
  return (
    <RevealOnScroll stagger className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
      {STATS.map((s) => (
        <div key={s.label} className="card-lift rounded-2xl border border-border bg-card p-5 text-center hover:border-primary/40">
          <div className="text-3xl">{s.icon}</div>
          <div className="mt-2 font-heading text-xl font-extrabold">{s.label}</div>
          <div className="text-xs text-muted-foreground">{s.sub}</div>
        </div>
      ))}
    </RevealOnScroll>
  );
}