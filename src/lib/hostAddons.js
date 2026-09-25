/**
 * D8 — Host Experience Principles.
 * Rules applied: D8.1 (plain language — add-ons named as human services).
 *
 * Single source of truth for add-on service display. Each entry maps a
 * host-friendly name to the internal addon fee key used by the RateCard.
 * No component may render raw addon key strings to hosts.
 */

// `price` is whole AUD dollars and must match ADDON_FEES (cents) in
// base44/shared/hostPricing.ts — the backend is the source of truth at payment.
export const HOST_ADDONS = [
  {
    key: 'legal_review',
    name: 'Legal review',
    icon: 'Scale',
    price: 99,
    description: 'Our legal team checks your challenge rules and terms so everything is above board.',
    feeKey: 'compliance_review_fee',
  },
  {
    key: 'social_campaign',
    name: 'Social campaign setup',
    icon: 'Megaphone',
    price: 149,
    description: 'We create ready-to-post social content and a launch plan to spread the word.',
    feeKey: 'marketing_module_fee',
  },
  {
    key: 'entry_moderation',
    name: 'Entry moderation',
    icon: 'ShieldCheck',
    price: 99,
    description: 'Our team reviews every entry before it appears publicly.',
    feeKey: 'content_filter_fee',
  },
  {
    key: 'judging_panel',
    name: 'Judging panel',
    icon: 'Award',
    price: 199,
    description: 'We arrange qualified judges to score entries fairly and transparently.',
    feeKey: 'judging_panel_fee',
  },
  {
    key: 'prize_handling',
    name: 'Prize handling',
    icon: 'Gift',
    price: 79,
    description: 'We look after prize payments and delivery to your winners.',
    feeKey: 'prize_admin_fee',
  },
  {
    key: 'winner_showcase',
    name: 'Winner showcase',
    icon: 'Sparkles',
    price: 59,
    description: 'A polished results page and announcement celebrating your winners.',
    feeKey: 'showcase_fee',
  },
];

export function getAddon(key) {
  return HOST_ADDONS.find((a) => a.key === key) || null;
}