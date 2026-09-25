export const num = (v) => (v == null ? '—' : Number(v).toLocaleString());

export const money = (v) =>
  v == null ? '—' : `$${Number(v).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

export const pct = (v) => (v == null ? '—' : `${Math.round(Number(v))}%`);

export const titleCase = (s = '') =>
  String(s).replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

// The counts worth showing beyond the four headline cards, in reading order.
export const DETAIL_ROWS = [
  { key: 'rejected', label: 'Not accepted', format: num },
  { key: 'winners', label: 'Winners', format: num },
  { key: 'scored_entries', label: 'Scored by judges', format: num },
  { key: 'total_votes', label: 'Votes cast', format: num },
  { key: 'verified_votes', label: 'Verified votes', format: num },
  { key: 'paid_entries', label: 'Paid entries', format: num },
  { key: 'entry_fees_collected', label: 'Entry fees collected', format: money },
  { key: 'refunds_pending', label: 'Refunds waiting', format: num },
  { key: 'guardian_pending', label: 'Guardian approvals waiting', format: num },
  { key: 'approved_percent', label: 'Share approved', format: pct },
  { key: 'pending_percent', label: 'Share awaiting review', format: pct },
];