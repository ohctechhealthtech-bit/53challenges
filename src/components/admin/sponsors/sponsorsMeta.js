export const TIERS = ['platinum', 'gold', 'silver', 'bronze', 'community'];

export const TIER_TONE = {
  platinum: 'bg-muted text-foreground',
  gold: 'bg-gold/15 text-gold',
  silver: 'bg-primary/15 text-primary',
  bronze: 'bg-chart-4/15 text-chart-4',
  community: 'bg-success/15 text-success',
};

export const AD_TYPES = ['product', 'pamphlet', 'banner', 'offer'];

export const APPLICATION_STATUSES = ['new', 'in_review', 'contacted', 'approved', 'rejected'];

export const STATUS_TONE = {
  new: 'bg-primary/15 text-primary',
  in_review: 'bg-gold/15 text-gold',
  contacted: 'bg-chart-2/15 text-chart-2',
  approved: 'bg-success/15 text-success',
  rejected: 'bg-destructive/15 text-destructive',
};

export const titleCase = (value) =>
  String(value || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase()) || '—';

export function money(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n) || n === 0) return '—';
  return n.toLocaleString('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 });
}

export function shortDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}