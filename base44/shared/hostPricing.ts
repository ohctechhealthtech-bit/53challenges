// Shared pricing table for host applications (amounts in cents, AUD).
// Used by the hostPortal 'price_application' / 'start_application_payment' actions.

export const PACKAGE_FEES: Record<string, { amount: number; label: string }> = {
  self_service: { amount: 0, label: 'Self-service package' },
  supported: { amount: 14900, label: 'Supported package deposit' },
  fully_managed: { amount: 29900, label: 'Fully managed package deposit' },
};

export const ADDON_FEES: Record<string, { amount: number; name: string }> = {
  legal_review: { amount: 9900, name: 'Legal review' },
  social_campaign: { amount: 14900, name: 'Social campaign setup' },
  entry_moderation: { amount: 9900, name: 'Entry moderation' },
  judging_panel: { amount: 19900, name: 'Judging panel' },
  prize_handling: { amount: 7900, name: 'Prize handling' },
  winner_showcase: { amount: 5900, name: 'Winner showcase' },
};

export function priceApplication(answers: any = {}) {
  const pkgKey = PACKAGE_FEES[answers.delivery_level] ? answers.delivery_level : 'self_service';
  const pkg = PACKAGE_FEES[pkgKey];
  const addonKeys: string[] = Array.isArray(answers.addons) ? answers.addons : [];
  const addons = addonKeys
    .filter((k) => ADDON_FEES[k])
    .map((k) => ({ key: k, name: ADDON_FEES[k].name, amount: ADDON_FEES[k].amount }));
  const addons_total = addons.reduce((s, a) => s + a.amount, 0);
  const total_amount = pkg.amount + addons_total;
  return {
    currency: 'aud',
    package: { key: pkgKey, label: pkg.label, amount: pkg.amount },
    addons,
    addons_total,
    total_amount,
    payment_required: total_amount > 0,
  };
}

// Simple routing / risk scoring used when an application is submitted.
export function scoreApplication(answers: any = {}) {
  const divisions: string[] = Array.isArray(answers.divisions) ? answers.divisions : [];
  const minors = divisions.includes('children') || divisions.includes('teens');
  const large = answers.participant_range === '1000_plus';
  let risk_level = 'low';
  let route_queue = 'standard';
  if (minors) { risk_level = 'high'; route_queue = 'compliance'; }
  else if (large) { risk_level = 'medium'; route_queue = 'senior'; }
  else if (answers.delivery_level === 'fully_managed') { risk_level = 'medium'; route_queue = 'coordinator'; }
  return { risk_level, route_queue };
}