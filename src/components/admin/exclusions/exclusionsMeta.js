export const REASON_LABELS = {
  organiser: 'Organiser',
  judge: 'Judge',
  staff: 'Staff',
  immediate_family: 'Immediate family',
};

export const reasonLabel = (r) => REASON_LABELS[r] || String(r || '').replace(/_/g, ' ') || '—';

export const REASON_TONE = {
  organiser: 'bg-primary/15 text-primary',
  judge: 'bg-chart-3/15 text-chart-3',
  staff: 'bg-muted text-muted-foreground',
  immediate_family: 'bg-gold/15 text-gold',
};

export function formatAdded(value) {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}