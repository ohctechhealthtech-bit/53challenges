import { Eye, Check, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { canDecide } from '@/components/admin/approvals/approvalMeta';

// Preview always available; Approve / Reject disabled (not hidden) once the
// entry has already been decided, as on the other ported tabs.
export default function ApprovalActionButtons({ row, busy, onPreview, onApprove, onReject }) {
  const allowed = canDecide(row);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="outline" size="sm" onClick={() => onPreview(row)}>
        <Eye className="h-4 w-4" /> Preview
      </Button>
      <Button
        size="sm"
        disabled={!allowed || !!busy}
        title={allowed ? '' : 'This entry has already been reviewed'}
        onClick={() => onApprove(row)}
      >
        {busy === 'approve' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Approve
      </Button>
      <Button
        variant="destructive"
        size="sm"
        disabled={!allowed || !!busy}
        title={allowed ? '' : 'This entry has already been reviewed'}
        onClick={() => onReject(row)}
      >
        {busy === 'reject' ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />} Reject
      </Button>
    </div>
  );
}