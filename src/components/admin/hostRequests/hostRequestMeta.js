// Status flow and grouping for the parent's Host requests hub.
export const STATUSES = ['new', 'in_review', 'contacted', 'accepted', 'declined'];

export const STATUS_LABELS = {
  new: 'New',
  in_review: 'In review',
  contacted: 'Contacted',
  accepted: 'Accepted',
  declined: 'Declined',
};

export const GROUP_LABELS = {
  proposals: 'Proposals',
  ideas: 'Ideas',
  enquiries: 'Enquiries',
};

// Which status changes apply to a request's current status, matching the
// parent's flow: new → in_review → contacted → accepted / declined.
export function allowedStatuses(status) {
  switch (status) {
    case 'new': return ['in_review', 'contacted', 'accepted', 'declined'];
    case 'in_review': return ['contacted', 'accepted', 'declined'];
    case 'contacted': return ['accepted', 'declined'];
    case 'accepted': return ['declined'];
    case 'declined': return ['in_review'];
    default: return STATUSES;
  }
}

export const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';