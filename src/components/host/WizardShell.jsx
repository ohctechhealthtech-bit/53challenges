/**
 * D8 — Host Experience Principles.
 * Rules applied: D8.2 (guided wizard — full-width question text, one question at a time).
 */
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2 } from 'lucide-react';

export default function WizardShell({
  stepIndex,
  totalSteps,
  question,
  hint,
  children,
  onBack,
  onNext,
  nextDisabled,
  nextLabel = 'Continue',
  submitting = false,
  hideNext = false,
  phaseLabel = 'Step 1: Apply',
  footerNote,
  progress,
  errorPanel,
}) {
  const pct = Math.round(((stepIndex + 1) / totalSteps) * 100);
  return (
    <div className="mx-auto w-full max-w-3xl rounded-3xl border border-border bg-card p-6 text-card-foreground shadow-xl shadow-black/10 sm:p-8">
      <div className="mb-8">
        {progress || (
          <>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {phaseLabel} · question {stepIndex + 1} of {totalSteps}
            </p>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full grad-bg transition-all duration-500" style={{ width: `${pct}%` }} />
            </div>
          </>
        )}
      </div>

      <h2 className="font-heading text-2xl font-extrabold sm:text-3xl">{question}</h2>
      {hint && <p className="mt-2 text-sm text-muted-foreground">{hint}</p>}

      {errorPanel && <div className="mt-5">{errorPanel}</div>}

      <div className="mt-6">{children}</div>

      <div className="mt-8 flex items-center justify-between gap-3">
        {onBack ? (
          <Button type="button" variant="outline" onClick={onBack} className="border-border text-foreground hover:bg-muted hover:text-primary">
            <ArrowLeft className="mr-1 h-4 w-4" /> Back
          </Button>
        ) : (
          <span />
        )}
        <div className="flex items-center gap-3">
          {footerNote}
          {!hideNext && (
            <Button type="button" onClick={onNext} disabled={nextDisabled || submitting} className="grad-bg border-0">
              {submitting && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              {nextLabel}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}