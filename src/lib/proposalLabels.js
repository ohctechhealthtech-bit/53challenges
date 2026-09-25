/**
 * Human-readable labels for stored proposal values, used by the admin
 * proposal review panel so staff read plain English instead of raw slugs.
 */
export const FIELD_LABELS = {
  host_type: 'Host type',
  delivery_level: 'Package',
  category: 'Entry category',
  participant_range: 'Expected participants',
  winner_method: 'How the winner is decided',
  program_scope: 'Format',
  scale_band: 'Scale band',
  review_status: 'Review status',
  divisions: 'Who can enter',
  addons: 'Added services',
  origin: 'Came from',
};

const VALUES = {
  // packages
  self_service: 'Self-service',
  supported: 'Supported',
  fully_managed: 'Fully managed',
  // host types
  business: 'Business',
  school: 'School',
  community_group: 'Community group',
  club: 'Club',
  council: 'Council',
  individual_host: 'Individual',
  // winner method
  public: 'Public voting',
  public_vote: 'Public voting',
  expert_panel: 'Expert judging panel',
  hybrid: 'Judges + public voting',
  measured_results: 'Measured results',
  // scope
  single: 'One-off challenge',
  series: 'Series of challenges',
  annual_program: 'Annual program',
  // divisions
  kids: 'Kids',
  teens: 'Teens',
  adults: 'Adults',
  seniors: 'Seniors',
  open: 'Open to everyone',
  // addons
  legal_review: 'Legal review',
  entry_moderation: 'Entry moderation',
  marketing_boost: 'Marketing boost',
  video_moderation: 'Video moderation',
  branded_page: 'Branded challenge page',
  // review status
  intake_received: 'Intake received',
  in_review: 'In review',
  builder_started: 'Builder started',
  submitted_for_review: 'Submitted for review',
  changes_requested: 'Changes requested',
  terms_pending: 'Terms pending',
  approved: 'Approved',
  approved_and_signed: 'Approved and signed',
  rejected: 'Declined',
  live: 'Live',
  // origins
  admin_created: 'Created by admin',
  corporate_intake: 'Custom idea intake',
  host_apply: 'Package proposal',
};

const RANGES = {
  under_50: 'Under 50 people',
  '50_250': '50 – 250 people',
  '250_1000': '250 – 1,000 people',
  '1000_plus': '1,000+ people',
};

/** Turns any stored slug into a readable label, falling back to title case. */
export function labelValue(value) {
  if (value === null || value === undefined || value === '') return '—';
  const key = String(value);
  if (RANGES[key]) return RANGES[key];
  if (VALUES[key]) return VALUES[key];
  return key.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Readable comma list for array fields (divisions, addons). */
export function labelList(values) {
  if (!Array.isArray(values) || values.length === 0) return '—';
  return values.map(labelValue).join(', ');
}