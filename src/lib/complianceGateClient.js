// Thin client wrappers around the complianceGate backend function, plus
// re-exports of the pure rule helpers (mirrored from the shared TS module so
// the frontend doesn't import server code).
export function unmetConditions(gate) {
  if (!gate) return [];
  const out = [];
  if (gate.legal_review_status !== 'cleared') out.push('legal_review_status must be "cleared"');
  if (!gate.promoter_confirmed) out.push('promoter_confirmed');
  if (!gate.terms_approved) out.push('terms_approved');
  if (!gate.minor_participation_reviewed) out.push('minor_participation_reviewed');
  if (!gate.voting_reviewed) out.push('voting_reviewed');
  if (!gate.permit_position_recorded) out.push('permit_position_recorded');
  if (!gate.prize_funding_confirmed) out.push('prize_funding_confirmed');
  if (!gate.legal_review_reference || !String(gate.legal_review_reference).trim()) out.push('legal_review_reference');
  return out;
}

export function canClearLaunchBlocked(gate) {
  return unmetConditions(gate).length === 0;
}