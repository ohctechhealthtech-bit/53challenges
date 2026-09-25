export const REVIEW_LABELS = {
  pending: 'Awaiting review',
  approved: 'Approved',
  rejected: 'Rejected',
};

export function fmtDate(v) {
  if (!v) return '—';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}

// Only a still-pending entry can be approved or rejected — matches the parent.
export function canDecide(row) {
  return (row?.review_state || row?.status) === 'pending';
}