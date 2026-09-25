/** Admin alert: how many "Tell us your idea" submissions are still unreviewed. */
import { Bell, ArrowRight } from 'lucide-react';

export default function NewIdeasAlert({ count, onOpen }) {
  if (!count) return null;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="mt-6 flex w-full items-center justify-between gap-4 rounded-2xl border border-primary/40 bg-primary/10 p-4 text-left transition-colors hover:bg-primary/15"
    >
      <span className="flex items-center gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground">
          <Bell className="h-5 w-5" />
        </span>
        <span>
          <span className="block text-sm font-bold">
            {count} new challenge {count === 1 ? 'request' : 'requests'} waiting for review
          </span>
          <span className="block text-xs text-muted-foreground">
            Sent in through “Tell us your idea” — open Host Requests to read the full details.
          </span>
        </span>
      </span>
      <ArrowRight className="h-5 w-5 shrink-0 text-primary" />
    </button>
  );
}