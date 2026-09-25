import { Button } from '@/components/ui/button';
import { Check, X, RotateCcw, Loader2 } from 'lucide-react';

export default function EntryBulkActionBar({ count, allSelected, onToggleAll, onAction, busy, filter }) {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-border bg-muted/50 px-3 py-2">
      <label className="flex items-center gap-2 text-xs font-semibold">
        <input
          type="checkbox"
          checked={allSelected}
          onChange={onToggleAll}
          className="h-4 w-4 accent-[hsl(var(--primary))]"
          aria-label="Select all visible entries"
        />
        Select all visible
      </label>
      <span className="text-xs text-muted-foreground">{count} selected</span>
      <div className="ml-auto flex flex-wrap gap-2">
        {busy && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        {filter !== 'approved' && (
          <Button size="sm" disabled={!count || busy} onClick={() => onAction('approved')}>
            <Check className="mr-1 h-3 w-3" /> Approve selected
          </Button>
        )}
        {filter !== 'rejected' && (
          <Button size="sm" variant="outline" disabled={!count || busy} onClick={() => onAction('rejected')}>
            <X className="mr-1 h-3 w-3" /> Reject selected
          </Button>
        )}
        {filter !== 'pending' && (
          <Button size="sm" variant="ghost" disabled={!count || busy} onClick={() => onAction('pending')}>
            <RotateCcw className="mr-1 h-3 w-3" /> Reset selected
          </Button>
        )}
      </div>
    </div>
  );
}