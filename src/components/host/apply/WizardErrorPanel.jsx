/** Per-screen validation errors — a red panel that scrolls itself into view. */
import { useEffect, useRef } from 'react';
import { AlertCircle } from 'lucide-react';

export default function WizardErrorPanel({ errors = [] }) {
  const ref = useRef(null);

  useEffect(() => {
    if (errors.length) ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [errors]);

  if (!errors.length) return null;

  return (
    <div ref={ref} role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 p-4">
      <p className="flex items-center gap-2 text-sm font-bold text-destructive">
        <AlertCircle className="h-4 w-4" aria-hidden="true" />
        {errors.length === 1 ? 'One thing to fix before we continue' : `${errors.length} things to fix before we continue`}
      </p>
      <ul className="mt-2 space-y-1 pl-6 text-sm text-destructive">
        {errors.map((e) => (
          <li key={`${e.field}-${e.message}`} className="list-disc">{e.message}</li>
        ))}
      </ul>
    </div>
  );
}