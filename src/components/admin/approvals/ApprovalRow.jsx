import { ExternalLink } from 'lucide-react';
import ApprovalThumb from '@/components/admin/approvals/ApprovalThumb';
import ApprovalActionButtons from '@/components/admin/approvals/ApprovalActionButtons';
import { REVIEW_LABELS, fmtDate } from '@/components/admin/approvals/approvalMeta';

export default function ApprovalRow({ row, busy, onPreview, onApprove, onReject }) {
  const openUrl = row.external_link || row.work_url;
  const tags = [row.division_name || row.division_id, ...(row.location_tags || [])].filter(Boolean);

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap gap-4">
        <ApprovalThumb row={row} />
        <div className="min-w-[260px] flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="font-heading text-base font-bold">{row.title || 'Untitled entry'}</h4>
            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
              {REVIEW_LABELS[row.review_state] || row.review_state || 'Awaiting review'}
            </span>
            {row.entry_type && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                {row.entry_type}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {row.entrant_name || 'Unknown entrant'} · {row.entrant_email || 'no email'}
          </p>
          <p className="text-sm text-muted-foreground">
            {row.challenge_title || 'Unknown challenge'} · Submitted {fmtDate(row.submitted_at)}
          </p>
          {tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {tags.map((t) => (
                <span key={t} className="rounded-md border border-border px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                  {t}
                </span>
              ))}
            </div>
          )}
          {row.description && <p className="mt-2 text-sm">{row.description}</p>}
          {openUrl && (
            <a
              href={openUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
            >
              <ExternalLink className="h-4 w-4" /> Open
            </a>
          )}
        </div>
        <div className="ml-auto self-start">
          <ApprovalActionButtons row={row} busy={busy} onPreview={onPreview} onApprove={onApprove} onReject={onReject} />
        </div>
      </div>
    </div>
  );
}