// Shared labels + helpers for the Judge roster admin section.

export const LEVELS = [
  { value: 'state', label: 'State' },
  { value: 'national', label: 'National' },
  { value: 'overall', label: 'Overall' },
];

export const DISCIPLINES = [
  { value: 'visual_arts', label: 'Visual arts' },
  { value: 'photography', label: 'Photography' },
  { value: 'writing_storytelling', label: 'Writing & storytelling' },
  { value: 'digital_creativity', label: 'Digital creativity' },
  { value: 'performance_voice', label: 'Performance & voice' },
  { value: 'dance', label: 'Dance' },
  { value: 'open_experimental', label: 'Open & experimental' },
];

export const APPLICATION_STATUSES = [
  { value: 'pending', label: 'Pending' },
  { value: 'new', label: 'New' },
  { value: 'in_review', label: 'In review' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'approved', label: 'Accepted' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'all', label: 'All' },
];

const LEVEL_MAP = Object.fromEntries(LEVELS.map((l) => [l.value, l.label]));
const DISC_MAP = Object.fromEntries(DISCIPLINES.map((d) => [d.value, d.label]));

export const levelLabel = (v) => LEVEL_MAP[v] || v || '—';
export const disciplineLabel = (v) => DISC_MAP[v] || String(v || '').replace(/_/g, ' ');
export const disciplineList = (arr) => (arr || []).map(disciplineLabel).join(', ') || '—';

export const APPLICATION_LABELS = {
  pending: 'Pending',
  new: 'New',
  in_review: 'In review',
  contacted: 'Contacted',
  approved: 'Accepted',
  rejected: 'Rejected',
};

export const ASSIGNMENT_LABELS = {
  pending: 'Invited',
  accepted: 'Accepted',
  declined: 'Declined',
  cancelled: 'Withdrawn',
};

// An application can only be decided while it is still open.
export const canDecideApplication = (status) =>
  ['pending', 'new', 'in_review', 'contacted'].includes(status);

// A withdrawal only makes sense for a live invitation.
export const canWithdraw = (status) => ['pending', 'accepted'].includes(status);

export function formatDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}