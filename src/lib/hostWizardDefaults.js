/**
 * D8 — Host Experience Principles.
 * Rules applied: D8.7 (defaults over decisions), D8.2 (silent mapping layer),
 * D8.1 (delivery levels named Self-service / Supported / Fully managed).
 *
 * Recommendation logic for the host wizard, plus the mapping layer that
 * translates plain-language answers into the structured internal field
 * values. Hosts never see the internal field names.
 */

export const DELIVERY_LEVELS = [
  {
    key: 'self_service',
    label: 'Self-service',
    description: 'You set everything up yourself with our step-by-step guide.',
  },
  {
    key: 'supported',
    label: 'Supported',
    description: 'You lead the way and our team helps with the tricky parts.',
  },
  {
    key: 'fully_managed',
    label: 'Fully managed',
    description: 'Our team runs the whole challenge for you from start to finish.',
  },
];

export const PARTICIPANT_RANGES = [
  { key: 'up_to_50', label: 'Up to 50', count: 50 },
  { key: '50_250', label: '50 – 250', count: 250 },
  { key: '250_1000', label: '250 – 1,000', count: 1000 },
  { key: '1000_plus', label: 'More than 1,000', count: 2000 },
];

export function participantCount(rangeKey) {
  return PARTICIPANT_RANGES.find((r) => r.key === rangeKey)?.count || 0;
}

/**
 * Returns the recommended default for every wizard step, based on the host's
 * application context. Hosts can always override any recommendation.
 */
export function getWizardDefaults(hostType, deliveryLevel, count = 0) {
  const category =
    hostType === 'business' ? 'digital-creativity'
    : hostType === 'school_community' ? 'visual-arts'
    : 'photography';

  const winnerMethod =
    count > 250 ? 'combination'
    : deliveryLevel === 'fully_managed' ? 'judges'
    : 'public';

  const divisions = hostType === 'school_community' ? ['children', 'teens'] : ['adults'];

  const programScope = deliveryLevel === 'fully_managed' ? 'series' : 'single';

  const addons = ['legal_review'];
  if (deliveryLevel === 'supported' || deliveryLevel === 'fully_managed' || count > 1000) {
    addons.push('entry_moderation');
  }
  if (deliveryLevel === 'fully_managed') {
    addons.push('social_campaign', 'judging_panel');
  }

  return {
    delivery_level: 'supported',
    category,
    winner_method: winnerMethod,
    divisions,
    participant_range: '50_250',
    program_scope: programScope,
    addons: [...new Set(addons)],
  };
}

/**
 * Silent mapping layer: translates plain-language wizard answers into the
 * structured field values the internal systems expect. Never shown to hosts.
 */
export function toStructuredAnswers(answers = {}) {
  const winnerMap = {
    public: { voting_purpose: 'determines_winner', weight_in_final_result: 100 },
    judges: { voting_purpose: 'audience_award_only', weight_in_final_result: 0 },
    combination: { voting_purpose: 'weighted_component', weight_in_final_result: 30 },
  };
  return {
    voting_configuration: winnerMap[answers.winner_method] || winnerMap.public,
    challenge: {
      category: answers.category || '',
      divisions: answers.divisions || [],
    },
    challenge_draft: {
      program_scope: answers.program_scope || 'single',
      scale_band: answers.participant_range || '',
    },
  };
}