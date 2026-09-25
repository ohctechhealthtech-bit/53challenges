// Shared loading / error / empty states for every Control Room panel.
import { Loader2, AlertTriangle, Inbox, KeyRound } from 'lucide-react';

export function PanelLoading({ label = 'Loading…' }) {
  return (
    <div className="flex items-center justify-center gap-2 py-14 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" /> {label}
    </div>
  );
}

export function PanelError({ message, onRetry }) {
  return (
    <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-5 text-sm">
      <p className="flex items-center gap-2 font-semibold text-destructive">
        <AlertTriangle className="h-4 w-4" /> Something went wrong
      </p>
      <p className="mt-1 text-muted-foreground">{message}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="mt-3 text-sm font-semibold text-primary underline">
          Try again
        </button>
      )}
    </div>
  );
}

export function PanelEmpty({ message = 'Nothing here yet.' }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border py-14 text-sm text-muted-foreground">
      <Inbox className="h-5 w-5" />
      {message}
    </div>
  );
}

export function SetupNotice() {
  return (
    <div className="mx-auto mt-16 max-w-md rounded-2xl border border-border bg-card p-8 text-center">
      <KeyRound className="mx-auto h-8 w-8 text-primary" />
      <h2 className="mt-4 font-heading text-lg font-bold">Judging isn't connected yet</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        The connection to the 53 Challenges judging service still needs to be set up.
        An administrator must add the judging service key (CHALLENGE_API_KEY) in the app settings.
      </p>
    </div>
  );
}