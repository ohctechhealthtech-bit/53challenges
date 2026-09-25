/**
 * Translates a saved pricing-calculator quote into /host-apply wizard answers
 * so the host doesn't re-enter what they already configured.
 */
const tierToDelivery = (name = '') => {
  const n = name.toLowerCase();
  if (n.includes('self')) return 'self_service';
  if (n.includes('manag')) return 'fully_managed';
  return 'supported';
};

const countToRange = (n = 0) =>
  n <= 50 ? 'up_to_50' : n <= 250 ? '50_250' : n <= 1000 ? '250_1000' : '1000_plus';

const WINNER = { expert_panel: 'judges', public_voting: 'public', hybrid: 'combination', measured_results: 'combination' };
const ADDON = { marketing_boost: 'social_campaign', video_moderation: 'entry_moderation' };
const SERIES_COUNT = { series: '3', annual_program: '6' };

export function quoteToApplyAnswers(savedQuote) {
  const c = savedQuote?.configuration || {};
  const scope = c.program_scope || 'single';
  return {
    saved_quote_id: savedQuote.id,
    delivery_level: tierToDelivery(c.tier_name),
    participant_range: countToRange(Number(c.participants || 0)),
    winner_method: WINNER[c.winner_mode] || 'combination',
    program_scope: scope,
    series_count: SERIES_COUNT[scope] || '',
    ...(c.category_slug ? { category: c.category_slug } : {}),
    addons: [...new Set((c.addons || []).map((k) => ADDON[k]).filter(Boolean))],
  };
}