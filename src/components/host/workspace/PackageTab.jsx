/**
 * Package tab — choose the level of support.
 */
import { Link } from 'react-router-dom';
import { Check, Zap, Users, Crown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { HOST_PACKAGES } from '@/lib/hostPackages';

const ICONS = { self_service: Zap, supported: Users, fully_managed: Crown };

export default function PackageTab({ currentPackage }) {
  return (
    <div>
      <div className="mb-8 text-center">
        <h2 className="font-heading text-2xl font-extrabold">Choose your delivery level</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          All three run on the same platform — pick how much support you want.
        </p>
      </div>
      <div className="grid gap-5 md:grid-cols-3">
        {HOST_PACKAGES.map((p) => {
          const Icon = ICONS[p.key] || Zap;
          const isCurrent = currentPackage === p.key;
          return (
            <div
              key={p.key}
              className={`relative flex flex-col rounded-2xl border bg-card p-5 ${
                isCurrent ? 'border-primary' : p.highlight ? 'border-amber-500/50' : 'border-border'
              }`}
            >
              {p.badge && !isCurrent && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-amber-500 px-3 py-0.5 text-[10px] font-bold text-black">
                  {p.badge}
                </span>
              )}
              <Icon className="mb-3 h-6 w-6 text-primary" aria-hidden="true" />
              <h3 className="font-heading text-lg font-bold">{p.name}</h3>
              <p className="mt-1 font-heading text-2xl font-extrabold">{p.price}</p>
              <p className="text-xs text-muted-foreground">{p.priceNote}</p>
              <p className="mt-3 text-sm text-muted-foreground">{p.audience}</p>
              <ul className="mt-4 flex-1 space-y-2">
                {p.benefits.map((b) => (
                  <li key={b} className="flex gap-2 text-sm">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" aria-hidden="true" />
                    <span className="text-muted-foreground">{b}</span>
                  </li>
                ))}
              </ul>
              {isCurrent ? (
                <div className="mt-5 rounded-xl border border-border py-2 text-center text-sm font-semibold text-muted-foreground">
                  Your current package ✓
                </div>
              ) : (
                <Button asChild className="mt-5 grad-bg border-0">
                  <Link to={`/host-apply?package=${p.key}`}>Choose {p.name}</Link>
                </Button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}