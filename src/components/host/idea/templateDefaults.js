/**
 * Turns a challenge template into the wizard's own answers, so picking a
 * template pre-fills category, who can enter, how the winner is decided, etc.
 */
import { ACTIVITY_OPTIONS } from '@/components/host/idea/ideaOptions';

const WIZARD_AGES = ['children', 'teens', 'adults', 'seniors'];

const AGE_MAP = {
  under_13: ['children'],
  ages_13_to_17: ['teens'],
  under_18: ['children', 'teens'],
  adults_18_plus: ['adults'],
  all_ages: ['children', 'teens', 'adults'],
  family_entry: ['children', 'teens', 'adults'],
  school_based: ['children', 'teens'],
  intergenerational: ['children', 'teens', 'adults', 'seniors'],
};

/** Answers to apply on top of the current wizard data for a chosen template. */
export function templateDefaults(t) {
  const patch = {
    template_id: t.id,
    template_name: t.template_name,
    challenge_title: t.template_name,
  };
  if (t.summary) patch.challenge_description = t.summary;

  if (ACTIVITY_OPTIONS.some((o) => o.value === t.category)) patch.activity_type = t.category;

  const ages = [
    ...new Set((t.age_groups || []).flatMap((a) => (WIZARD_AGES.includes(a) ? [a] : AGE_MAP[a] || []))),
  ];
  if (ages.length) patch.age_groups = ages;

  const rules = [...(t.rules_expectations || [])];
  if (t.entry_type === 'team') rules.push('teams_allowed');
  if (t.entry_type === 'individual') rules.push('individual_only');
  if (t.entry_limit_per_participant === 1) rules.push('one_entry');
  else if (Number(t.entry_limit_per_participant) > 1) rules.push('multiple_entries');
  if (rules.length) patch.rules_expectations = rules;

  return patch;
}

/** Everything a template fills in — cleared when the host goes custom again. */
export const TEMPLATE_CLEARED = {
  template_id: '',
  template_name: '',
  challenge_title: '',
  challenge_description: '',
  activity_type: '',
  age_groups: [],
  rules_expectations: [],
};