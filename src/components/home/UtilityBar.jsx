import { Link } from 'react-router-dom';
import { Trophy, Users, Building2, ArrowRight } from 'lucide-react';

// Cream "How do you want to take part?" strip with red / teal / gold icons.
export default function UtilityBar() {
  const cols = [
    { icon: Trophy, title: 'Compete', cta: 'Find your challenge', to: '/challenges', accent: '#ff4d4d' },
    { icon: Users, title: 'Support', cta: 'Watch and vote', to: '/challenges?phase=vote', accent: '#14b8a6' },
    { icon: Building2, title: 'Organisations', cta: 'Run or sponsor a challenge', to: '/run-a-challenge', accent: '#facc15' },
  ];
  return (
    <section className="border-y border-border" style={{ backgroundColor: '#fdfbf7' }}>
      <div className="container-tight py-8">
        <p className="text-center text-sm font-semibold uppercase tracking-wider text-stone-500">How do you want to take part?</p>
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          {cols.map((c) => (
            <Link key={c.title} to={c.to} className="group flex items-center gap-4 rounded-2xl border border-stone-300/70 bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-md" style={{ ['--accent']: c.accent }}>
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full" style={{ backgroundColor: c.accent, color: '#fff' }}>
                <c.icon className="h-6 w-6" />
              </span>
              <div className="flex-1">
                <p className="font-heading font-bold text-stone-900">{c.title}</p>
                <p className="text-sm font-medium" style={{ color: c.accent }}>
                  {c.cta} <ArrowRight className="inline h-3.5 w-3.5" />
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}