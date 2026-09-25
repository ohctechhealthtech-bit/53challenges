// Shared compliance-gate helpers used by the admin function AND the three
// enforcement points (challengeApi proxy, submitChallengeEntry, castVote).
//
// INTERIM (Prompt 13) containment model:
//  - A gate is a LOCAL overlay keyed by the external challenge_id.
//  - Enforcement blocks a write ONLY when a gate EXISTS and launch_blocked=true.
//    Challenges with no gate (e.g. not yet synced) pass through — this avoids
//    retroactively blocking already-live challenges like the Australian Dance
//    Challenge, whose gate is created by the admin `sync` action as
//    grandfathered_live (launch_blocked=false, legal_review_status=in_progress).
//  - `launch_blocked` can only be cleared (set false) via the admin update
//    action when legal_review_status=cleared AND all six boolean checks are
//    true AND legal_review_reference is non-empty. `grandfathered_live` is set
//    only by sync, never by update, so it cannot be used to bypass the rule.

// Fields an admin may edit directly. grandfathered_live is intentionally
// absent — it is set only by the sync action.
export const UPDATABLE_FIELDS = [
  "legal_review_status",
  "promoter_confirmed",
  "terms_approved",
  "minor_participation_reviewed",
  "voting_reviewed",
  "permit_position_recorded",
  "prize_funding_confirmed",
  "launch_blocked",
  "legal_review_reference",
  "gate_notes",
];

const DEFAULTS = {
  legal_review_status: "not_started",
  promoter_confirmed: false,
  terms_approved: false,
  minor_participation_reviewed: false,
  voting_reviewed: false,
  permit_position_recorded: false,
  prize_funding_confirmed: false,
  launch_blocked: true,
  legal_review_reference: "",
  gate_notes: "",
  grandfathered_live: false,
};

// TRUE only when every condition for clearing launch_blocked is met.
export function canClearLaunchBlocked(gate) {
  if (!gate) return false;
  return (
    gate.legal_review_status === "cleared" &&
    !!gate.promoter_confirmed &&
    !!gate.terms_approved &&
    !!gate.minor_participation_reviewed &&
    !!gate.voting_reviewed &&
    !!gate.permit_position_recorded &&
    !!gate.prize_funding_confirmed &&
    !!gate.legal_review_reference &&
    String(gate.legal_review_reference).trim().length > 0
  );
}

// VOTING_PURPOSES that require a legal opinion before the challenge can go live.
const VOTING_PURPOSES_REQUIRING_LEGAL = new Set([
  "determines_winner",
  "weighted_component",
]);

// Full clearance check including DB records (Prompt 15):
//  - A PromoterAppointment must exist for the challenge (rule 3).
//  - If a VotingConfiguration exists with voting_purpose determines_winner or
//    weighted_component, it must carry a legal_opinion_reference (rule 2).
// Returns { canClear, missing } — `missing` is the list of unmet conditions.
export async function evaluateClearance(sr, gate) {
  const missing = unmetConditions(gate);
  if (!gate?.challenge_id) {
    missing.push("challenge_id missing (cannot verify promoter/voting records)");
    return { canClear: false, missing };
  }
  // Rule 3: PromoterAppointment is the only source of truth for the promoter.
  const promo = await sr.entities.PromoterAppointment.filter(
    { challenge_id: String(gate.challenge_id) }, "-created_date", 1
  ).catch(() => []);
  if (!promo || !promo.length) {
    missing.push("promoter_appointment (no PromoterAppointment record)");
  }
  // Rule 2: determines_winner / weighted_component voting needs a legal opinion.
  const vc = await sr.entities.VotingConfiguration.filter(
    { challenge_id: String(gate.challenge_id) }, "-created_date", 1
  ).catch(() => []);
  if (vc && vc.length) {
    const purpose = vc[0].voting_purpose || "";
    if (VOTING_PURPOSES_REQUIRING_LEGAL.has(purpose)) {
      const ref = String(vc[0].legal_opinion_reference || "").trim();
      if (!ref) {
        missing.push("voting_legal_opinion (voting_purpose='" + purpose + "' requires legal_opinion_reference)");
      }
    }
  }
  return { canClear: missing.length === 0, missing };
}

// Returns the list of unmet conditions (for error messages / UI hints).
export function unmetConditions(gate) {
  const out = [];
  if (gate.legal_review_status !== "cleared") out.push("legal_review_status must be 'cleared'");
  if (!gate.promoter_confirmed) out.push("promoter_confirmed");
  if (!gate.terms_approved) out.push("terms_approved");
  if (!gate.minor_participation_reviewed) out.push("minor_participation_reviewed");
  if (!gate.voting_reviewed) out.push("voting_reviewed");
  if (!gate.permit_position_recorded) out.push("permit_position_recorded");
  if (!gate.prize_funding_confirmed) out.push("prize_funding_confirmed");
  if (!gate.legal_review_reference || !String(gate.legal_review_reference).trim()) out.push("legal_review_reference");
  return out;
}

// Write one audit-log row. Best-effort — never throws the caller.
export async function logEvent(sr, evt) {
  try {
    await sr.entities.ComplianceGateLog.create({
      gate_id: evt.gate_id,
      challenge_id: evt.challenge_id || "",
      action: evt.action || "field_change",
      field_name: evt.field_name || "",
      old_value: evt.old_value != null ? String(evt.old_value) : "",
      new_value: evt.new_value != null ? String(evt.new_value) : "",
      changed_by_id: evt.changed_by_id || "",
      changed_by_email: evt.changed_by_email || "",
      note: evt.note || "",
    });
  } catch {}
}

// Create a gate with defaults for a challenge_id that has no gate yet.
// `live` (from sync) controls the grandfathering: a challenge that is already
// live upstream is grandfathered (not blocked, in_progress) so its live state
// is unchanged; a non-live challenge gets the protective default (blocked).
export async function createGate(sr, challenge_id, challenge_title, live, actor) {
  const existing = await sr.entities.ComplianceGate.filter({ challenge_id }, "-created_date", 1);
  if (existing && existing.length) {
    if (challenge_title && !existing[0].challenge_title) {
      await sr.entities.ComplianceGate.update(existing[0].id, { challenge_title });
    }
    return { gate: existing[0], created: false };
  }
  const fields = {
    ...DEFAULTS,
    challenge_id,
    challenge_title: challenge_title || "",
  };
  if (live) {
    fields.grandfathered_live = true;
    fields.launch_blocked = false;
    fields.legal_review_status = "in_progress";
  }
  const gate = await sr.entities.ComplianceGate.create(fields);
  await logEvent(sr, {
    gate_id: gate.id,
    challenge_id,
    action: live ? "grandfathered" : "gate_created",
    changed_by_id: actor?.id || "",
    changed_by_email: actor?.email || "",
    note: live
      ? "Auto-created during sync for an already-live challenge — grandfathered live, legal review in progress."
      : "Auto-created during sync with launch_blocked=true (interim default).",
  });
  return { gate, created: true };
}

// Enforcement check used by the three write paths.
// Returns true when the write must be blocked. No gate => not blocked.
export async function isLaunchBlocked(sr, challenge_id) {
  if (!challenge_id) return false;
  try {
    const existing = await sr.entities.ComplianceGate.filter({ challenge_id }, "-created_date", 1);
    if (!existing || !existing.length) return false;
    return existing[0].launch_blocked === true;
  } catch {
    // If the gate lookup fails, fail open (do not block) — the interim gate
    // must not take the whole platform down on a DB error.
    return false;
  }
}

// Extract the challenge_id from a write-action body, across the shapes used
// by the external Challenge API (submit_entry nests it under entry).
export function challengeIdFromBody(body) {
  if (!body) return "";
  if (body.challenge_id) return String(body.challenge_id);
  if (body.entry && body.entry.challenge_id) return String(body.entry.challenge_id);
  return "";
}