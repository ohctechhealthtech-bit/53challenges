import { Link } from 'react-router-dom';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { TRUST_PAGES } from '@/lib/siteConfig';

/**
 * Shared layout for trust / legal pages (Privacy, Terms, Rules, etc).
 * Renders a consistent hero, max-width content container, and sidebar nav.
 */
export default function TrustPageLayout({ title, subtitle, children, lastUpdated }) {
  return (
    <div className="container-tight py-12 lg:py-16">
      <div className="grid gap-10 lg:grid-cols-[260px_1fr]">
        {/* Sidebar nav */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-2xl border border-border bg-card p-5">
            <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              <ShieldCheck className="h-4 w-4 text-primary" /> Trust & Legal
            </p>
            <ul className="mt-4 space-y-1">
              {TRUST_PAGES.map((p) => {
                const active = p.label === title || (title === 'Competition Rules' && p.to === '/competition-rules');
                return (
                  <li key={p.to}>
                    <Link
                      to={p.to}
                      className={`block rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                        active ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                      }`}
                    >
                      {p.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
            <div className="mt-5 rounded-xl border border-border bg-muted/50 p-4">
              <p className="text-sm font-semibold text-foreground">Questions?</p>
              <p className="mt-1 text-xs text-muted-foreground">Contact our team for help with any of these policies.</p>
              <Link to="/contact-us" className="mt-3 inline-flex items-center gap-1 text-sm font-bold text-primary hover:underline">
                Contact Us <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </aside>

        {/* Content */}
        <article className="min-w-0">
          <header>
            <h1 className="font-heading text-3xl font-extrabold sm:text-4xl">{title}</h1>
            {subtitle && <p className="mt-2 text-lg text-muted-foreground">{subtitle}</p>}
            {lastUpdated && (
              <p className="mt-3 text-xs text-muted-foreground">Last updated: {lastUpdated}</p>
            )}
          </header>
          <div className="prose prose-invert mt-8 max-w-none">
            {children}
          </div>
        </article>
      </div>
    </div>
  );
}