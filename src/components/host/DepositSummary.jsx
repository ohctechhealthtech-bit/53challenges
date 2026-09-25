/**
 * D8 — Host Experience Principles.
 * Rules applied: D8.1 (plain language), D8.3 (calm tone — no red on this screen).
 */
import { getAddon } from '@/lib/hostAddons';
import { getDeposit, formatAud } from '@/lib/hostDeposit';
import { DELIVERY_LEVELS } from '@/lib/hostWizardDefaults';

export default function DepositSummary({ proposal }) {
  const deposit = getDeposit(proposal.delivery_level);
  const pkg = DELIVERY_LEVELS.find((d) => d.key === proposal.delivery_level);
  const addons = (proposal.addons || []).map((k) => getAddon(k)).filter(Boolean);

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <p className="text-sm text-muted-foreground">
        You're almost there. Pay the deposit to send your proposal to our team.
      </p>

      <div className="mt-5 space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Your challenge</p>
        <p className="font-heading text-lg font-bold">{proposal.challenge_title || 'Your challenge'}</p>
      </div>

      <div className="mt-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">How much help</p>
        <p className="mt-1 text-sm font-semibold">{pkg?.label}</p>
        {pkg?.description && <p className="mt-1 text-xs text-muted-foreground">{pkg.description}</p>}
      </div>

      <div className="mt-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Services you've asked for</p>
        {addons.length === 0 ? (
          <p className="mt-1 text-sm text-muted-foreground">None — you can add these any time.</p>
        ) : (
          <ul className="mt-2 space-y-1 text-sm">
            {addons.map((a) => (
              <li key={a.key} className="flex items-start gap-2">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-400" aria-hidden="true" />
                {a.name}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-6 flex items-baseline justify-between border-t border-border pt-5">
        <span className="text-sm font-semibold">Deposit due today</span>
        <span className="font-heading text-2xl font-extrabold">{formatAud(deposit?.amount || 0)}</span>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        This deposit comes off your final cost. We'll confirm everything else with you before anything goes live.
      </p>
    </div>
  );
}