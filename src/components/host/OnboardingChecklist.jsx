/**
 * D8 — Host Experience Principles.
 * Rules applied: D8.3 (horizontal checklist, not blockers) — 5 numbered steps.
 * Three states: green tick = done, blue = current, grey = still to come.
 */
import { Check } from 'lucide-react';
import { HOST_JOURNEY_STEPS as STEPS } from '@/components/host/journeySteps';

export default function OnboardingChecklist({ currentStep = 1 }) {
  return (
    <div>
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Your journey to going live
      </p>
      <ol className="flex items-center gap-1 sm:gap-2">
        {STEPS.map((label, i) => {
          const stepNum = i + 1;
          const isDone = stepNum < currentStep;
          const isActive = stepNum === currentStep;
          // The connector after this step: filled green once passed, blue while
          // leading into the current step, grey otherwise.
          const nextIsActive = stepNum + 1 === currentStep;
          return (
            <li key={label} className="flex flex-1 items-center gap-1 sm:gap-2">
              <div className="flex min-w-0 flex-col items-center gap-1.5 text-center">
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    isDone
                      ? 'bg-success text-white'
                      : isActive
                      ? 'bg-primary text-white'
                      : 'border border-border bg-muted text-muted-foreground'
                  }`}
                  aria-hidden="true"
                >
                  {isDone ? <Check className="h-4 w-4" /> : stepNum}
                </span>
                <span
                  className={`text-[10px] sm:text-xs ${
                    isActive
                      ? 'font-bold text-foreground'
                      : isDone
                      ? 'font-semibold text-[#2E9B66]'
                      : 'font-semibold text-muted-foreground'
                  }`}
                >
                  {label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <span
                  className={`step-connector h-px flex-1 bg-border ${
                    isDone || nextIsActive ? 'is-filled' : ''
                  } ${isDone ? 'text-success' : 'text-primary'}`}
                  aria-hidden="true"
                />
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}