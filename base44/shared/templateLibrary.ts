// Shared Template Library helpers: defaults, validation, recommendation scoring.

export const HOST_EDITABLE_BRAND_FIELDS = [
  'logo_url',
  'primary_colour_hex',
  'secondary_colour_hex',
  'hero_image_url',
  'campaign_message',
  'hashtag',
  'call_to_action',
];

export const ADMIN_MANAGED_BRAND_FIELDS = [
  'approved_social_templates',
  'legal_footer',
  'powered_by_attribution',
];

export function defaultLockMap() {
  const map = {};
  for (const f of HOST_EDITABLE_BRAND_FIELDS) map[f] = 'host_editable';
  for (const f of ADMIN_MANAGED_BRAND_FIELDS) map[f] = 'admin_managed';
  return map;
}

export function blankTemplate() {
  return {
    origin: 'admin_created',
    is_template: true,
    template_name: 'Untitled template',
    template_family_id: 'fam_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36),
    template_version: 1,
    template_status: 'draft',
    service_tier: 'standard',
    template_tags: [],
    concept_pack: {
      package_name: '',
      primary_category_id: '',
      subcategory_id: '',
      corporate_objective: [],
      target_audience: [],
      challenge_description: '',
      expected_outcome: '',
      entry_type: 'individual',
      delivery_mode: 'online',
      recommended_duration_weeks: 4,
      recommended_prize_structure: '',
    },
    rules_pack: {
      eligibility_summary: '',
      age_groups: [],
      eligible_locations: [],
      winner_selection_method: 'expert_judging',
      judging_criteria: [],
      ai_use_policy: 'human_only',
      ai_disclosure_required: true,
      human_contribution_statement_required: true,
      prohibited_ai_uses: [],
      required_declarations: [],
      prohibited_content_summary: '',
      tie_breaking_method: '',
      entry_limit_per_participant: 1,
      team_size_minimum: null,
      team_size_maximum: null,
    },
    brand_pack: {
      logo_url: '',
      primary_colour_hex: '#1677C8',
      secondary_colour_hex: '#102A43',
      hero_image_url: '',
      campaign_message: '',
      hashtag: '',
      call_to_action: '',
      approved_social_templates: [],
      legal_footer: '',
      powered_by_attribution: true,
    },
    participation_pack: {},
    operations_pack: {},
    legal_pack: {},
    lock_map: defaultLockMap(),
    template_recommendation_config: {
      target_organisation_types: [],
      target_categories: [],
      target_service_tiers: [],
      target_audience_types: [],
      min_participant_count: null,
      max_participant_count: null,
      recommendation_categories: [],
      recommendation_formats: [],
      recommendation_age_groups: [],
      recommendation_settings: [],
      recommendation_host_types: [],
      recommendation_delivery_levels: [],
      recommendation_org_kinds: [],
      recommendation_weight: 1,
    },
    template_audit_log: [],
  };
}

const JUDGING_METHODS = ['expert_judging', 'host_judging', 'community_voting', 'combined'];
const HEX = /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/;

export function validateTemplate(t) {
  const errors = [];
  const c = t.concept_pack || {};
  const r = t.rules_pack || {};
  const b = t.brand_pack || {};

  if (!t.template_name || !t.template_name.trim()) errors.push('Template name is required.');
  if (!t.primary_category_id && !c.primary_category_id) errors.push('A primary category is required.');
  if (!c.package_name) errors.push('Concept: package name is required.');
  if (!c.challenge_description || c.challenge_description.length < 40) {
    errors.push('Concept: description must be at least 40 characters.');
  }
  if (!c.expected_outcome) errors.push('Concept: expected outcome is required.');
  if (!(Number(c.recommended_duration_weeks) > 0)) errors.push('Concept: recommended duration must be a positive number of weeks.');
  if (c.entry_type === 'team') {
    if (!(Number(r.team_size_minimum) > 0) || !(Number(r.team_size_maximum) > 0)) {
      errors.push('Rules: team entries need a minimum and maximum team size.');
    }
  }

  if (!r.eligibility_summary) errors.push('Rules: eligibility summary is required.');
  if (!Array.isArray(r.age_groups) || r.age_groups.length === 0) errors.push('Rules: select at least one age group.');
  if (JUDGING_METHODS.includes(r.winner_selection_method)) {
    const criteria = Array.isArray(r.judging_criteria) ? r.judging_criteria : [];
    if (criteria.length === 0) errors.push('Rules: judging-based methods need at least one judging criterion.');
    const total = criteria.reduce((s, x) => s + Number(x.weight || 0), 0);
    if (criteria.length > 0 && total !== 100) errors.push(`Rules: judging criteria weights must total exactly 100 (currently ${total}).`);
  }
  if (!r.tie_breaking_method) errors.push('Rules: a tie-breaking method is required.');
  if (!(Number(r.entry_limit_per_participant) > 0)) errors.push('Rules: entry limit per participant must be at least 1.');

  if (!HEX.test(b.primary_colour_hex || '')) errors.push('Brand: primary colour must be a valid hex value.');
  if (!HEX.test(b.secondary_colour_hex || '')) errors.push('Brand: secondary colour must be a valid hex value.');
  if (b.hashtag && /\s/.test(b.hashtag)) errors.push('Brand: hashtag cannot contain spaces.');
  if (b.logo_url && !/^https?:\/\//.test(b.logo_url)) errors.push('Brand: logo URL must start with http(s)://');
  if (b.hero_image_url && !/^https?:\/\//.test(b.hero_image_url)) errors.push('Brand: hero image URL must start with http(s)://');
  if (!b.campaign_message) errors.push('Brand: campaign message is required.');
  if (!b.call_to_action) errors.push('Brand: call to action is required.');
  if (!b.legal_footer) errors.push('Brand: legal footer is required.');

  return errors;
}

function matchesSignal(selected, permitted = [], universalValues = []) {
  if (!selected) return { applicable: false, matched: false, unrestricted: false };
  const isEmpty = !Array.isArray(permitted) || permitted.length === 0;
  if (isEmpty) return { applicable: true, matched: true, unrestricted: true };
  const hasUniversal = universalValues.some((u) => permitted.includes(u));
  if (hasUniversal) return { applicable: true, matched: true, unrestricted: true };
  return { applicable: true, matched: permitted.includes(selected), unrestricted: false };
}

export function scoreTemplate(template, answers) {
  const cfg = template.template_recommendation_config || {};

  // Category: fall back to the template's own primary category when no
  // explicit matching list has been configured.
  const catPermitted = cfg.recommendation_categories?.length
    ? cfg.recommendation_categories
    : (template.primary_category_id ? [template.primary_category_id] : []);

  const signals = [
    { name: 'category', selected: answers.category, permitted: catPermitted, weight: 40, universal: ['all', 'any'] },
    { name: 'format', selected: answers.format, permitted: cfg.recommendation_formats, weight: 25, universal: ['all', 'any'] },
    { name: 'age_group', selected: answers.age_group, permitted: cfg.recommendation_age_groups, weight: 20, universal: ['all', 'any', 'all_ages'] },
    { name: 'setting', selected: answers.setting, permitted: cfg.recommendation_settings, weight: 15, universal: ['all', 'any'] },
    { name: 'delivery_level', selected: answers.delivery_level, permitted: cfg.recommendation_delivery_levels, weight: 10, universal: ['all', 'any'] },
    { name: 'host_type', selected: answers.host_type, permitted: cfg.recommendation_host_types, weight: 5, universal: ['all', 'any'] },
    { name: 'org_kind', selected: answers.org_kind, permitted: cfg.recommendation_org_kinds, weight: 5, universal: ['all', 'any'] },
  ];

  let score = 0;
  let possibleScore = 0;
  const reasons: string[] = [];

  for (const signal of signals) {
    const result = matchesSignal(signal.selected, signal.permitted, signal.universal);
    if (!result.applicable) continue;
    possibleScore += signal.weight;
    if (result.matched) {
      score += result.unrestricted ? signal.weight * 0.5 : signal.weight;
      if (!result.unrestricted) reasons.push(signal.name);
    }
  }

  return {
    score,
    match_percentage: possibleScore > 0 ? Math.round((score / possibleScore) * 100) : 0,
    matched_signals: reasons,
  };
}

export function rankTemplates(templates, answers, limit = 5) {
  return templates
    .map((t) => {
      const s = scoreTemplate(t, answers);
      return { template: t, score: s.score, match_percentage: s.match_percentage, matched_signals: s.matched_signals };
    })
    .sort((a, b) =>
      b.score - a.score ||
      b.match_percentage - a.match_percentage ||
      (Number(b.template.template_recommendation_config?.recommendation_weight || 1) -
        Number(a.template.template_recommendation_config?.recommendation_weight || 1)) ||
      String(a.template.template_name || '').localeCompare(String(b.template.template_name || '')),
    )
    .slice(0, limit);
}

export function mergeApprovedBrand(snapshotBrand, hostOverrides, adminAdjustments, lockMap) {
  const map = lockMap && Object.keys(lockMap).length ? lockMap : defaultLockMap();
  const out = { ...(snapshotBrand || {}) };
  for (const [field, mode] of Object.entries(map)) {
    if (mode === 'host_editable' && hostOverrides && hostOverrides[field] !== undefined && hostOverrides[field] !== '') {
      out[field] = hostOverrides[field];
    }
  }
  for (const [field, value] of Object.entries(adminAdjustments || {})) {
    if (value !== undefined) out[field] = value;
  }
  return out;
}