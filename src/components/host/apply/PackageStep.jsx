/**
 * Package choice for the host apply wizard — each tile shows price, deposit
 * note and the services included so hosts can compare before choosing.
 */
import { Check, Star } from 'lucide-react';
import useHostPackages from '@/hooks/useHostPackages';

export default function PackageStep({ value, onChange }) {
  const { packages } = useHostPackages();

  return (
    <div className="grid gap-4 lg:grid-cols-3" role="radiogroup" aria-label="Hosting package">
      {packages.map((pkg) => {
        const selected = value === pkg.key;
        return (
          <button
            key={pkg.key}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(pkg.key)}
            className={`relative flex flex-col rounded-2xl border-2 p-5 text-left transition ${
              selected ? 'border-primary bg-primary/5 shadow-md' : 'border-border bg-card hover:border-primary/50'
            }`}
          >
            {pkg.badge && (
              <span className="absolute -top-3 left-4 inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-0.5 text-[11px] font-bold text-white">
                {pkg.highlight && <Star className="h-3 w-3 fill-gold text-gold" />} {pkg.badge}
              </span>
            )}
            {selected && <Check className="absolute right-4 top-4 h-5 w-5 text-primary" aria-hidden="true" />}

            <h3 className="font-heading text-lg font-extrabold">{pkg.name}</h3>
            <p className="text-sm font-semibold text-primary">{pkg.tagline}</p>
            {pkg.headline && <p className="mt-1 text-xs text-muted-foreground">{pkg.headline}</p>}

            <div className="mt-4">
              <p className="font-heading text-2xl font-extrabold">{pkg.price}</p>
              {pkg.priceNote && <p className="mt-0.5 text-xs text-muted-foreground">{pkg.priceNote}</p>}
            </div>

            <ul className="mt-4 flex-1 space-y-2 border-t border-border pt-4">
              {(pkg.benefits || []).map((b, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  {b.endsWith('plus:') ? (
                    <span className="font-semibold text-muted-foreground">{b}</span>
                  ) : (
                    <>
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" />
                      <span>{b}</span>
                    </>
                  )}
                </li>
              ))}
            </ul>
          </button>
        );
      })}
    </div>
  );
}