export const LEVELS = [
  { value: 'state', label: 'State' },
  { value: 'national', label: 'National' },
  { value: 'overall', label: 'Overall' },
];

export const STATUS_TONE = {
  accepted: 'bg-success/15 text-success',
  pending: 'bg-gold/15 text-gold',
  invited: 'bg-gold/15 text-gold',
  declined: 'bg-destructive/15 text-destructive',
  cancelled: 'bg-muted text-muted-foreground',
};

export const prettyList = (arr) =>
  (arr || []).map((v) => String(v).replace(/[_-]/g, ' ')).join(', ') || '—';

export function formatDateTime(value) {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}