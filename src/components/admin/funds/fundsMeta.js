export const POOL_LABELS = {
  sponsorship_pool: 'Sponsorship pool',
  competition_fund: 'Competition fund',
  split: 'Split across both pools',
};

export const SOURCE_LABELS = {
  entry_fee: 'Entry fee',
  sponsor_contribution: 'Sponsor contribution',
  donation: 'Donation',
  prize_paid: 'Prize paid',
  sponsorship_granted: 'Sponsorship granted',
  cost: 'Cost',
  refund: 'Refund',
};

export const PURPOSE_LABELS = {
  prize_paid: 'Prize payment',
  sponsorship_granted: 'Sponsorship grant',
  cost: 'Running cost',
};

export const label = (map, value) =>
  map[value] || String(value || '').replace(/_/g, ' ') || '—';

export function money(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 2 });
}

export function when(value) {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleString('en-AU', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}