/** One row in the unified "My requests & applications" list. */
import { KIND_LABELS, statusLabel, statusTone } from '@/lib/myApplications';

export default function ApplicationRow({ item }) {
  return (
    <li className="rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {KIND_LABELS[item.kind] || 'Request'}
          </p>
          <p className="mt-1 truncate font-heading text-lg font-bold">{item.title}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {item.subtitle}
            {item.submitted_at && (
              <>
                {item.subtitle ? ' · ' : ''}
                Sent {new Date(item.submitted_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
              </>
            )}
          </p>
        </div>
        <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${statusTone(item.status)}`}>
          {statusLabel(item.status)}
        </span>
      </div>

      {item.feedback && (
        <p className="mt-3 rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-muted-foreground">
          {item.feedback}
        </p>
      )}
    </li>
  );
}