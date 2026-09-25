/** Inline, per-field error message for wizard questions. */
import { AlertCircle } from 'lucide-react';

/** Extra classes that mark an input as having an error. */
export const errorRing = (message) =>
  message ? 'border-destructive ring-1 ring-destructive/40' : '';

export default function FieldError({ id, message }) {
  if (!message) return null;
  return (
    <p id={id} className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-destructive">
      <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      {message}
    </p>
  );
}