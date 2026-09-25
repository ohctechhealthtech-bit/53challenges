/** Seven-segment progress bar — one segment per wizard phase. */
import { PHASES } from '@/lib/applyWizardModel';

export default function WizardProgress({ phase, stepIndex, totalSteps }) {
  const activeIndex = Math.max(0, PHASES.findIndex((p) => p.key === phase));
  const label = PHASES[activeIndex]?.label || '';

  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label} · question {stepIndex + 1} of {totalSteps}
      </p>
      <div className="flex gap-1.5" role="progressbar" aria-valuemin={1} aria-valuemax={PHASES.length} aria-valuenow={activeIndex + 1} aria-label={`Step ${activeIndex + 1} of ${PHASES.length}: ${label}`}>
        {PHASES.map((p, i) => (
          <span
            key={p.key}
            title={p.label}
            className={`h-1.5 flex-1 rounded-full transition-colors duration-500 ${i <= activeIndex ? 'grad-bg' : 'bg-muted'}`}
          />
        ))}
      </div>
    </div>
  );
}