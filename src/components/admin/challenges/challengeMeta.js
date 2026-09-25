// Shared labels + helpers for the All challenges admin section.

export const SORTS = [
  { value: '-created_date', label: 'Newest first' },
  { value: 'created_date', label: 'Oldest first' },
  { value: 'end_date', label: 'Closing soonest' },
  { value: '-submission_count', label: 'Most entries' },
  { value: 'title', label: 'Title A–Z' },
];

export const STATUS_LABELS = {
  draft: 'Draft',
  active: 'Open',
  voting: 'Voting',
  completed: 'Finished',
  archived: 'Archived',
};

export const statusLabel = (v) => STATUS_LABELS[v] || v || '—';

export const titleCase = (v) =>
  String(v || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) || '—';

// Judging weights lock the moment a challenge leaves Draft.
export const weightsLocked = (challenge) => {
  if (!challenge?.id) return false;
  if (challenge.config_locked_at) return true;
  return (challenge.round_stage || challenge.status) !== 'draft';
};

export const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

export const fmtFee = (cents) => {
  const n = Number(cents || 0);
  if (!n) return 'Free';
  return `$${(n >= 1000 ? n / 100 : n).toFixed(2).replace(/\.00$/, '')}`;
};

// Date inputs speak YYYY-MM-DD; the parent stores full ISO timestamps.
export const toDay = (v) => (v ? String(v).slice(0, 10) : '');
export const toIso = (v) => (v ? `${String(v).slice(0, 10)}T00:00:00Z` : '');