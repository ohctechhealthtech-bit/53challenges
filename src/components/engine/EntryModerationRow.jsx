import { safeExternalUrl } from '@/lib/safeUrl';
export default function EntryModerationRow({ entry, busy, selected, onToggleSelect, children }) {
  return (
    <li className={`rounded-lg border border-border bg-background p-3 ${busy ? 'opacity-60' : ''} ${selected ? 'ring-1 ring-primary' : ''}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        {onToggleSelect && (
          <input
            type="checkbox"
            checked={!!selected}
            onChange={() => onToggleSelect(entry.id)}
            aria-label={`Select entry ${entry.title}`}
            className="mt-1.5 h-4 w-4 shrink-0 accent-[hsl(var(--primary))]"
          />
        )}
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{entry.title}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {entry.creator_name} · {entry.state} · {entry.division}
            {entry.is_minor ? ' · minor' : ''}
          </p>
          {entry.work_text && (
            <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{entry.work_text}</p>
          )}
          {entry.work_link && (
            safeExternalUrl(entry.work_link) ? (
              <a href={safeExternalUrl(entry.work_link)} target="_blank" rel="noreferrer" className="mt-2 inline-block break-all text-xs font-semibold text-primary hover:underline">
                {entry.work_link}
              </a>
            ) : (
              // Shown, not linked. The value is entrant-supplied and this row
              // is read by moderators, so a javascript: URL here would run
              // with an admin at the keyboard.
              <p className="mt-2 break-all text-xs text-muted-foreground" title="Not a http(s) link — shown as text">
                {entry.work_link}
              </p>
            )
          )}
        </div>
        <div className="flex flex-wrap gap-2">{children}</div>
      </div>
    </li>
  );
}