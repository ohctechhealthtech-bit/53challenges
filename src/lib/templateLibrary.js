import { base44 } from '@/api/base44Client';

const call = async (payload) => {
  const res = await base44.functions.invoke('templateLibrary', payload);
  if (res.data?.error) throw new Error(res.data.error);
  return res.data;
};

export const templateLibrary = {
  list: (filters = {}) => call({ action: 'list', ...filters }),
  versions: (template_family_id) => call({ action: 'versions', template_family_id }),
  create: () => call({ action: 'create' }),
  save: (id, patch) => call({ action: 'save', id, patch }),
  // Bulk-import records as DRAFT templates only — never published or activated.
  importDrafts: (records) => call({ action: 'importDrafts', records }),
  validate: (id) => call({ action: 'validate', id }),
  publish: (id) => call({ action: 'publish', id }),
  newVersion: (id) => call({ action: 'newVersion', id }),
  archive: (id, reason) => call({ action: 'archive', id, reason }),
  recommend: (answers, limit = 5) => call({ action: 'recommend', answers, limit }),
  selectTemplate: (template_id) => call({ action: 'selectTemplate', template_id }),
  approveProposal: (proposal_id, admin_brand_adjustments) =>
    call({ action: 'approveProposal', proposal_id, admin_brand_adjustments }),
};

export const SERVICE_TIERS = [
  { value: 'standard', label: 'Standard' },
  { value: 'professional', label: 'Professional' },
  { value: 'enterprise', label: 'Enterprise' },
  { value: 'custom', label: 'Custom' },
];

export const TEMPLATE_STATUSES = [
  { value: 'draft', label: 'Draft' },
  { value: 'active', label: 'Active' },
  { value: 'superseded', label: 'Superseded' },
  { value: 'archived', label: 'Archived' },
];

export const ENTRY_TYPES = [
  { value: 'individual', label: 'Individual' },
  { value: 'team', label: 'Team' },
  { value: 'supported', label: 'Supported' },
];

export const DELIVERY_MODES = [
  { value: 'online', label: 'Online' },
  { value: 'physical', label: 'In person' },
  { value: 'hybrid', label: 'Hybrid' },
];

export const AGE_GROUPS = [
  { value: 'under_13', label: 'Under 13' },
  { value: 'ages_13_to_17', label: 'Ages 13–17' },
  { value: 'under_18', label: 'Under 18' },
  { value: 'adults_18_plus', label: 'Adults 18+' },
  { value: 'all_ages', label: 'All ages' },
  { value: 'family_entry', label: 'Family entry' },
  { value: 'school_based', label: 'School based' },
  { value: 'intergenerational', label: 'Intergenerational' },
];

export const WINNER_METHODS = [
  { value: 'expert_judging', label: 'Expert judging' },
  { value: 'host_judging', label: 'Host judging' },
  { value: 'community_voting', label: 'Community voting' },
  { value: 'combined', label: 'Combined judging and voting' },
  { value: 'random_draw', label: 'Random draw' },
  { value: 'participation_reward', label: 'Participation reward' },
];

export const JUDGING_METHODS = ['expert_judging', 'host_judging', 'community_voting', 'combined'];

export const AI_POLICIES = [
  { value: 'human_only', label: 'Human only' },
  { value: 'ai_assisted', label: 'AI assisted' },
  { value: 'ai_generated', label: 'AI generated' },
  { value: 'mixed', label: 'Mixed' },
];

export const REGISTRATION_TYPES = [
  { value: 'individual', label: 'Individual' },
  { value: 'team', label: 'Team' },
  { value: 'school_class', label: 'School class' },
  { value: 'family', label: 'Family' },
  { value: 'organisation', label: 'Organisation' },
];

export const ENGAGEMENT_TOOLS = [
  { value: 'comments', label: 'Comments' },
  { value: 'social_sharing', label: 'Social sharing' },
  { value: 'leaderboards', label: 'Leaderboards' },
  { value: 'community_voting', label: 'Community voting' },
  { value: 'badges', label: 'Badges and streaks' },
  { value: 'progress_updates', label: 'Progress updates' },
];

export const PERMIT_TYPES = [
  { value: 'lottery', label: 'Lottery permit' },
  { value: 'trade_promotion', label: 'Trade promotion permit' },
  { value: 'game_of_chance', label: 'Game of chance authority' },
  { value: 'charitable_fundraising', label: 'Charitable fundraising' },
  { value: 'none_required', label: 'None required' },
];

export const labelFor = (options, value) =>
  options.find((o) => o.value === value)?.label || value || '—';

export const packOptions = { REGISTRATION_TYPES, ENGAGEMENT_TOOLS, PERMIT_TYPES };