/** Turns stored idea-submission values back into the words the host saw. */
import {
  ORG_TYPE_OPTIONS, ACTIVITY_OPTIONS, WINNER_OPTIONS, AGE_OPTIONS,
  PARTICIPANT_OPTIONS, PRIZE_OPTIONS, BUDGET_OPTIONS, TIMING_OPTIONS,
  SCOPE_OPTIONS, REACH_OPTIONS, PURPOSE_OPTIONS, RULE_HELPER_OPTIONS,
  JUDGE_SOURCE_OPTIONS, ORG_KIND_OPTIONS,
} from '@/components/host/idea/ideaOptions';

const toMap = (opts) => Object.fromEntries(opts.map((o) => [o.value, o.label]));

export const IDEA_LABELS = {
  org_type: toMap(ORG_TYPE_OPTIONS),
  activity_type: toMap(ACTIVITY_OPTIONS),
  winner_method: toMap(WINNER_OPTIONS),
  age_groups: toMap(AGE_OPTIONS),
  participants: toMap(PARTICIPANT_OPTIONS),
  prize_pool: toMap(PRIZE_OPTIONS),
  budget: toMap(BUDGET_OPTIONS),
  timing: toMap(TIMING_OPTIONS),
  scope: toMap(SCOPE_OPTIONS),
  reach: toMap(REACH_OPTIONS),
  primary_objective: toMap(PURPOSE_OPTIONS),
  secondary_objectives: toMap(PURPOSE_OPTIONS),
  rules_expectations: toMap(RULE_HELPER_OPTIONS),
  judging_source: toMap(JUDGE_SOURCE_OPTIONS),
  org_kind: toMap(ORG_KIND_OPTIONS),
};

export const ideaLabel = (field, value) => IDEA_LABELS[field]?.[value] || value || '—';

export const ideaLabels = (field, values) =>
  Array.isArray(values) && values.length ? values.map((v) => ideaLabel(field, v)).join(', ') : '—';

// Pipeline statuses come from the Host Ideas API.
export const IDEA_STATUS_OPTIONS = [
  { value: 'new', label: 'New' },
  { value: 'in_review', label: 'In review' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'declined', label: 'Not proceeding' },
];

export const ideaStatusLabel = (v) =>
  IDEA_STATUS_OPTIONS.find((o) => o.value === v)?.label || 'New';