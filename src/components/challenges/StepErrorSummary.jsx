import { AlertTriangle } from 'lucide-react';

// Summary of everything blocking the current step, shown at the top of the
// wizard card so a blocked "Next" is never silent.
export default function StepErrorSummary({ errors }) {
  const messages = Object.entries(errors || {})
    .filter(([key, msg]) => typeof msg === 'string' && msg && !['form', 'duplicate', 'excluded'].includes(key))
    .map(([, msg]) => msg);

  if (messages.length === 0) return null;

  return (
    <div className="mb-3 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
      <p className="flex items-center gap-2 font-semibold">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        {messages.length === 1 ? 'One thing needs your attention' : `${messages.length} things need your attention`}
      </p>
      <ul className="mt-1.5 list-disc space-y-0.5 pl-6">
        {messages.map((msg) => <li key={msg}>{msg}</li>)}
      </ul>
    </div>
  );
}