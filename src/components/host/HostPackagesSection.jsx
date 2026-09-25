/**
 * D8 — Host Experience Principles: plain language, benefit-led copy.
 * Package cards on /host-a-challenge that deep-link into the apply wizard
 * with the chosen package pre-selected.
 */
import { Link } from 'react-router-dom';
import { Check, ArrowRight, Star } from 'lucide-react';
import useHostPackages from '@/hooks/useHostPackages';
import { useAuth } from '@/lib/AuthContext';

export default function HostPackagesSection() {
  const { packages } = useHostPackages();
  const { isAuthenticated } = useAuth();
  // Signed-in hosts go straight to their workspace, landing on the
  // "Host a challenge" tab with the package they picked already selected.
  const applyBase = isAuthenticated ? '/host-dashboard' : '/host-apply';

  return (
    <section className="container-tight py-14">
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-xs font-bold uppercase tracking-widest text-primary">Hosting packages</p>
        <h2 className="mt-2 font-heading text-3xl font-extrabold sm:text-4xl">
          Pick a package, <span className="grad-text">propose in minutes</span>
        </h2>
        <p className="mt-3 text-muted-foreground">
          Choose how much help you'd like — every package runs on the same trusted platform.
          Select one and your proposal is pre-filled, ready to send in about three minutes.
        </p>
      </div>

      <div className="mt-10 grid gap-6 lg:grid-cols-3">
        {packages.map((pkg) => (
          <div
            key={pkg.key}
            className={`relative flex flex-col rounded-3xl p-8 transition ${
              pkg.highlight
                ? 'border-2 border-[#1677C8] bg-[#EBF4FF] text-[#102A43]'
                : 'border border-border bg-card/60 card-lift'
            }`}
          >
            {pkg.badge && (
              <span
                className={`absolute -top-3 left-6 inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold ${
                  pkg.highlight ? 'grad-bg text-white' : 'border border-border bg-secondary text-foreground'
                }`}
              >
                {pkg.highlight && <Star className="h-3 w-3 fill-[#F4B740] text-[#F4B740]" />} {pkg.badge}
              </span>
            )}

            <h3 className="font-heading text-2xl font-extrabold">{pkg.name}</h3>
            <p className={`mt-1 text-sm font-semibold ${pkg.highlight ? 'text-[#1677C8]' : 'text-primary'}`}>
              {pkg.headline || pkg.tagline}
            </p>
            {pkg.outcome && (
              <p className={`mt-2 text-sm ${pkg.highlight ? 'text-slate-700' : 'text-foreground'}`}>{pkg.outcome}</p>
            )}

            <div className="mt-5">
              <p className="font-heading text-3xl font-extrabold">{pkg.price}</p>
              <p className={`mt-1 text-xs ${pkg.highlight ? 'text-slate-600' : 'text-muted-foreground'}`}>{pkg.priceNote}</p>
            </div>

            <p className={`mt-4 rounded-xl px-3 py-2 text-xs ${
              pkg.highlight
                ? 'border border-[#1677C8]/30 bg-white/70 text-slate-700'
                : 'border border-border bg-white/5 text-muted-foreground'
            }`}>
              {pkg.reassurance || pkg.audience}
            </p>

            <ul className="mt-6 flex-1 space-y-2.5">
              {(pkg.benefits || []).map((b, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  {b.endsWith('plus:') ? (
                    <span className={`font-semibold ${pkg.highlight ? 'text-slate-600' : 'text-muted-foreground'}`}>{b}</span>
                  ) : (
                    <>
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#2E9B66]" aria-hidden="true" />
                      <span>{b}</span>
                    </>
                  )}
                </li>
              ))}
            </ul>

            <Link
              to={`${applyBase}?package=${pkg.key}`}
              className={`mt-8 inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-bold transition ${
                pkg.highlight
                  ? 'grad-bg text-white hover:-translate-y-0.5'
                  : 'border border-primary bg-transparent text-primary hover:bg-primary hover:text-white'
              }`}
            >
              {pkg.cta || `Start with ${pkg.name}`} <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        ))}
      </div>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        Not sure which fits? Start with any package — you can change your mind during the proposal, and we'll confirm everything before anything goes live.
      </p>
    </section>
  );
}