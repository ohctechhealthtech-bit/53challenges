import { GraduationCap, Image as ImageIcon, ExternalLink } from 'lucide-react';
import { SITE_CONFIG } from '@/lib/siteConfig';

const PORTALS = [
  {
    name: '53 Classes',
    tagline: 'Learn the craft',
    body: 'Live and online classes across art, music, writing and more — taught by working creatives.',
    cta: 'Explore classes',
    href: SITE_CONFIG.classesDomain,
    icon: GraduationCap,
    color: '#0a8882',
  },
  {
    name: '53 Gallery',
    tagline: 'Show your work',
    body: 'A curated home for finished work — browse the gallery and see what creators across Australia are making.',
    cta: 'Visit the gallery',
    href: SITE_CONFIG.galleryDomain,
    icon: ImageIcon,
    color: '#7c3aed',
  },
];

/** Cross-promotion for the other 53 portals, shown on the dashboard Home tab. */
export default function PortalPromo() {
  return (
    <section>
      <h2 className="text-lg font-bold text-slate-900">More from the 53 network</h2>
      <p className="mt-1 text-sm text-slate-500">Your 53 Challenges account works across all of it.</p>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {PORTALS.map((p) => (
          <a
            key={p.name}
            href={p.href}
            target="_blank"
            rel="noopener noreferrer"
            className="group rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <span
              className="grid h-10 w-10 place-items-center rounded-xl"
              style={{ backgroundColor: `${p.color}1a`, color: p.color }}
            >
              <p.icon className="h-5 w-5" />
            </span>
            <p className="mt-3 text-xs font-bold uppercase tracking-wide" style={{ color: p.color }}>
              {p.tagline}
            </p>
            <h3 className="mt-0.5 text-lg font-bold text-slate-900">{p.name}</h3>
            <p className="mt-1 text-sm text-slate-500">{p.body}</p>
            <span
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-bold text-white"
              style={{ backgroundColor: p.color }}
            >
              {p.cta} <ExternalLink className="h-4 w-4" />
            </span>
          </a>
        ))}
      </div>
    </section>
  );
}