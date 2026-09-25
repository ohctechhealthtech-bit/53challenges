export const VOTE_VIEWS = [
  { key: 'all', label: 'All votes' },
  { key: 'suspicious', label: 'Needs a look' },
];

export const VOTE_STATUS_TONE = {
  valid: 'bg-success/15 text-success',
  flagged: 'bg-gold/15 text-gold',
  blocked: 'bg-destructive/15 text-destructive',
};

export function formatCastAt(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-AU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

// Short, readable stand-in for the hashed IP — the full hash is in the title.
export const shortHash = (hash) => (hash ? `${String(hash).slice(0, 10)}…` : '—');

// How many votes in this list share a device, so repeat devices are obvious.
export function deviceCounts(votes = []) {
  return votes.reduce((acc, v) => {
    if (v.device_id) acc[v.device_id] = (acc[v.device_id] || 0) + 1;
    return acc;
  }, {});
}