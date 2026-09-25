import { useEffect, useState } from 'react';

const LINKS = [
  { id: 'overview', label: 'Overview' },
  { id: 'work', label: 'Included Work' },
  { id: 'benefits', label: 'Benefits' },
  { id: 'eligibility', label: 'Eligibility' },
  { id: 'how', label: 'How It Works' },
  { id: 'challenges', label: 'Challenges' },
];

export default function CategoryStickyNav({ accent = '#ff4d4d' }) {
  const [active, setActive] = useState('overview');

  useEffect(() => {
    const onScroll = () => {
      let current = 'overview';
      for (const l of LINKS) {
        const el = document.getElementById(l.id);
        if (el && el.getBoundingClientRect().top <= 140) current = l.id;
      }
      setActive(current);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="sticky top-16 z-30 hidden border-y border-border bg-background/90 backdrop-blur-md md:block">
      <nav className="container-tight flex items-center gap-1 overflow-x-auto scrollbar-hide">
        {LINKS.map((l) => (
          <a
            key={l.id}
            href={`#${l.id}`}
            className="whitespace-nowrap rounded-full px-4 py-2.5 text-sm font-medium transition-colors"
            style={active === l.id ? { color: accent, backgroundColor: accent + '1a' } : { color: 'hsl(var(--muted-foreground))' }}
          >
            {l.label}
          </a>
        ))}
      </nav>
    </div>
  );
}