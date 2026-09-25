// Pure pricing calculator. No fee/threshold/multiplier is hard-coded — every
// figure reads from the active RateCard and CampaignScaleBand records passed in.

export const WINNER_MODES = [
  { key: 'expert_panel', label: 'Expert panel' },
  { key: 'public_voting', label: 'Public voting engine' },
  { key: 'hybrid', label: 'Hybrid (panel + public)' },
  { key: 'measured_results', label: 'Measured-results validation' },
];

export const ADDONS = [
  { key: 'marketing_boost', label: 'Marketing boost' },
  { key: 'video_moderation', label: 'Video moderation' },
  { key: 'branded_page', label: 'Branded challenge page' },
];

export const PROGRAM_SCOPES = [
  { key: 'single', label: 'Single challenge', count: 1, discountKey: null },
  { key: 'series', label: 'Series of 3', count: 3, discountKey: 'series_of_3' },
  { key: 'annual_program', label: 'Annual program of 6', count: 6, discountKey: 'annual_of_6' },
];

export const fmt = (n) => '$' + Math.round(Number(n) || 0).toLocaleString('en-AU');

export function computeQuote(rateCard, scaleBands, tiers, inputs) {
  const tier = tiers.find((t) => t.id === inputs.service_tier_id);
  const band = scaleBands.find((b) => b.id === inputs.scale_band_id);
  const scaleMultiplier = band ? Number(band.service_fee_multiplier || 1) : 1;
  const isEnterprise = !!(band && (band.pricing_mode === 'by_proposal' || band.routing === 'enterprise_pipeline'));
  const tierId = inputs.service_tier_id || '';
  const tierName = tier?.name || 'Service tier';
  const winnerLabel = WINNER_MODES.find((w) => w.key === inputs.winner_mode)?.label || inputs.winner_mode;

  const base = Number(rateCard?.tier_base_fees?.[tierId] || 0);
  const participantsIncluded = Number(rateCard?.participants_included?.[tierId] || 0);
  const perExtra100 = Number(rateCard?.per_extra_100?.[tierId] || 0);
  const weeksIncluded = Number(rateCard?.weeks_included?.[tierId] || 0);
  const perExtraWeek = Number(rateCard?.per_extra_week?.[tierId] || 0);

  const participants = Number(inputs.participants || 0);
  const durationWeeks = Number(inputs.duration_weeks || 0);

  const extraPaxCount = Math.max(0, participants - participantsIncluded);
  const extraPaxUnits = Math.ceil(extraPaxCount / 100);
  const extraPaxFee = extraPaxUnits * perExtra100;

  const extraWeeksCount = Math.max(0, durationWeeks - weeksIncluded);
  const extraWeeksFee = extraWeeksCount * perExtraWeek;

  const judgingFee = Number(rateCard?.judging_fees?.[inputs.winner_mode] || 0);
  const needsPermit = inputs.winner_mode === 'public_voting' || inputs.winner_mode === 'hybrid';
  const permitFee = needsPermit ? Number(rateCard?.permit_assistance_fee || 0) : 0;

  const addonKeys = Array.isArray(inputs.addons) ? inputs.addons : [];
  const addonLines = addonKeys.map((k) => ({
    key: k,
    label: ADDONS.find((a) => a.key === k)?.label || k,
    amount: Number(rateCard?.addon_fees?.[k] || 0),
  }));
  const addonsTotal = addonLines.reduce((s, a) => s + a.amount, 0);

  const perChallengeService = base + extraPaxFee + extraWeeksFee + judgingFee + permitFee + addonsTotal;
  const perChallengeScaled = perChallengeService * scaleMultiplier;

  const scope = PROGRAM_SCOPES.find((s) => s.key === inputs.program_scope) || PROGRAM_SCOPES[0];
  const programCount = scope.count;
  const discountPct = scope.discountKey ? Number(rateCard?.program_discounts?.[scope.discountKey] || 0) : 0;

  const grossService = perChallengeScaled * programCount;
  const discountAmount = (grossService * discountPct) / 100;

  const prizePool = Number(inputs.prize_pool || 0);
  const prizeAdminPct = Number(rateCard?.prize_admin_pct || 0);
  const prizeAdmin = (prizePool * prizeAdminPct) / 100;

  const subtotal = grossService - discountAmount + prizeAdmin;
  const gstPct = Number(rateCard?.gst_pct || 0);
  const gst = (subtotal * gstPct) / 100;
  const total = subtotal + gst;

  // Build line items grouped by section for the quote board.
  const lines = [];
  lines.push({ key: 'base', label: `${tierName} base fee`, amount: base, section: 'per_challenge' });
  if (extraPaxFee > 0)
    lines.push({ key: 'extra_pax', label: 'Extra participants', amount: extraPaxFee, note: `${extraPaxCount} over ${participantsIncluded} included`, section: 'per_challenge' });
  if (extraWeeksFee > 0)
    lines.push({ key: 'extra_weeks', label: 'Extra duration', amount: extraWeeksFee, note: `${extraWeeksCount} over ${weeksIncluded} weeks`, section: 'per_challenge' });
  lines.push({ key: 'judging', label: `Judging — ${winnerLabel}`, amount: judgingFee, section: 'per_challenge' });
  if (needsPermit)
    lines.push({ key: 'permit', label: 'Permit assistance', amount: permitFee, note: 'Required for public voting / hybrid', section: 'per_challenge' });
  for (const a of addonLines)
    lines.push({ key: 'addon_' + a.key, label: a.label, amount: a.amount, section: 'per_challenge' });
  if (scaleMultiplier !== 1)
    lines.push({ key: 'scale', label: `Scale uplift (×${scaleMultiplier})`, amount: perChallengeScaled - perChallengeService, note: 'Service fees only', section: 'per_challenge' });
  if (programCount > 1)
    lines.push({ key: 'program', label: `× ${programCount} challenges`, amount: perChallengeScaled * (programCount - 1), section: 'program' });
  if (discountAmount > 0)
    lines.push({ key: 'discount', label: `Program discount (${discountPct}%)`, amount: -discountAmount, section: 'program' });
  if (prizeAdmin > 0)
    lines.push({ key: 'prize_admin', label: `Prize administration (${prizeAdminPct}%)`, amount: prizeAdmin, note: 'No scale uplift applied', section: 'prize' });
  lines.push({ key: 'subtotal', label: 'Subtotal', amount: subtotal, section: 'summary' });
  lines.push({ key: 'gst', label: `GST (${gstPct}%)`, amount: gst, section: 'summary' });
  lines.push({ key: 'total', label: 'Total', amount: total, section: 'summary', isTotal: true });

  return { lines, subtotal, gst, total, isEnterprise, scaleMultiplier, programCount, needsPermit };
}