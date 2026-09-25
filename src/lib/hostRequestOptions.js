// Shared option lists + status rules for host challenge requests (enquiries).
// Used by the public enquiry form and by the host's own view/edit dialog.

export const INDUSTRIES = [
  'Arts & Culture', 'Education & Training', 'Health & Wellbeing', 'Tech & Software', 'Retail & Consumer', 'Food & Beverage',
  'Hospitality & Tourism', 'Finance & Insurance', 'Construction & Trades', 'Manufacturing', 'Agriculture & Environment',
  'Government / Council', 'Non-profit / Charity', 'Media & Entertainment', 'Sports & Recreation', 'Fashion & Beauty',
  'Real Estate & Property', 'Legal & Professional Services', 'Transport & Logistics', 'Energy & Utilities', 'Other',
];

export const CHALLENGE_TYPES = [
  'Visual Arts (painting, illustration, design)',
  'Photography',
  'Writing (poetry, short story, essays)',
  'Digital Creativity (video, animation, coding, UI)',
  'Performance & Voice (music, dance, spoken word)',
  'Open / Experimental',
  'Not sure yet — help us decide',
];

export const GOALS = ['Brand awareness', 'Community engagement', 'Product launch', 'Discover & support talent', 'CSR / social impact', 'Team / employee engagement', 'Education & skill-building', 'Other'];
export const AUDIENCE_SIZES = ['Under 100', '100 – 500', '500 – 2,000', '2,000 – 10,000', '10,000+'];
export const SCOPES = ['Australia-wide', 'A specific state / region', 'A specific city / LGA', 'Online only', 'In-person event', 'Schools & students'];
export const TIMINGS = ['ASAP (next 2–4 weeks)', '1–3 months', '3–6 months', '6+ months', 'Just exploring'];
export const BUDGETS = ['Under $5k', '$5k – $10k', '$10k – $25k', '$25k – $50k', '$50k+', "Let's discuss"];
export const PRIZES = ['Cash prize pool', 'Products / merchandise', 'Mentorship or exposure', 'Internships / opportunities', "A mix — let's discuss"];
export const HOW_HEARD = ['Google / search', 'Social media', 'Word of mouth', 'Event / conference', 'Referral from a partner', 'Saw a 53 challenge', 'Other'];

/** Statuses where the host may still edit their own request. */
export const OPEN_STATUSES = ['new', 'planning', 'contacted', 'in-progress'];

/** Plain-language status labels shown to the host. */
export const STATUS_LABELS = {
  new: 'Submitted',
  planning: 'Being planned',
  contacted: 'In conversation',
  'in-progress': 'In review',
  approved: 'Approved',
  completed: 'Completed',
  rejected: 'Not proceeding',
};

export function isRequestEditable(status) {
  return OPEN_STATUSES.includes(String(status || 'new'));
}

export function statusLabel(status) {
  return STATUS_LABELS[String(status || 'new')] || 'Submitted';
}