// Guardian Consent Helper (Prompt 20)
//
// Verifiable, scope-granular guardian consent for minor participants.
// Handles the consent lifecycle, entry visibility rules, withdrawal takedown,
// and gate integration for the accept_minors lifecycle gate.
//
// KEY INVARIANTS:
//  - Rule 1: A minor's entry saves as pending_consent and becomes valid only
//    on granted + entering_challenge + terms_acceptance + personal_info_processing.
//  - Rule 2: Display surfaces check publication scopes; platform floor: first
//    name + state only, never full name, age, or DOB publicly.
//  - Rule 3: Judges never see age or identity; blind judging shows only an
//    approved eligibility bracket.
//  - Rule 4: Prize payment to a minor routes to the verified guardian through
//    the existing two-person release.
//  - Rule 5: Withdrawal removes public display, blocks future uses, and is
//    audit-logged. Consent is versioned against exact wording + scopes.
//  - Rule 6: accept_minors gate requires this workflow active and configured.

// Scopes that are minimum-required for a minor's entry to become valid.
export const MINIMUM_SCOPES = [
  "scopes_entering_challenge",
  "scopes_terms_acceptance",
  "scopes_personal_info_processing",
] as const;

// All consent scopes (for reference / validation).
export const ALL_SCOPES = [
  "scopes_entering_challenge",
  "scopes_terms_acceptance",
  "scopes_personal_info_processing",
  "scopes_public_display_name",
  "scopes_public_display_age_bracket",
  "scopes_publication_of_entry_media",
  "scopes_promotional_reuse",
  "scopes_direct_communication_with_minor",
  "scopes_public_voting_participation",
  "scopes_prize_acceptance_payment",
  "scopes_event_travel_attendance",
  "scopes_appears_in_entry",
] as const;

// ── Inline audit logging (shared modules can't import each other) ──
async function logAuditInline(sr, evt) {
  try {
    await sr.entities.ComplianceAuditEvent.create({
      event_type: evt.event_type,
      challenge_id: evt.challenge_id || "",
      assessment_id: evt.assessment_id || "",
      finding_id: evt.finding_id || "",
      actor_id: evt.actor_id || "",
      actor_email: evt.actor_email || "",
      detail: evt.detail || "",
    });
  } catch {}
}

// ── Check if a consent record has the minimum required scopes ──────────
export function hasMinimumConsent(consent): boolean {
  if (!consent) return false;
  if (consent.status !== "granted") return false;
  return MINIMUM_SCOPES.every((s) => consent[s] === true);
}

// ── Check if an entry is visible in public gallery / voting ────────────
// Rule: A minor's entry is invisible to gallery/voting until
// publication_of_entry_media is granted.
export function isEntryVisibleToPublic(entry, consent): boolean {
  if (!entry) return false;
  if (!entry.is_minor) return true; // Non-minors: standard visibility rules
  if (!consent) return false;
  if (consent.status !== "granted") return false;
  return consent.scopes_publication_of_entry_media === true;
}

// ── Check if an entry is valid for judging ─────────────────────────────
// Entry-only consent (minimum scopes) still allows judging.
// Judges never see age or identity — only an approved eligibility bracket.
export function isEntryValidForJudging(entry, consent): boolean {
  if (!entry) return false;
  if (!entry.is_minor) return true;
  if (!consent) return false;
  return hasMinimumConsent(consent);
}

// ── Mask a minor's name to first name only ─────────────────────────────
// Platform floor: first name + state only, never full name, age, or DOB.
export function maskMinorName(fullName: string): string {
  if (!fullName) return "";
  return fullName.trim().split(/\s+/)[0];
}

// ── Get the eligibility bracket for blind judging ──────────────────────
// Judges see only the division bracket, never the exact age or identity.
export function getEligibilityBracket(entry): string {
  if (!entry) return "";
  const division = entry.division || "adults";
  const bracketMap: Record<string, string> = {
    children: "Under 13",
    teens: "13–17",
    adults: "18+",
    ndi: "NDI",
  };
  return bracketMap[division] || "Eligible";
}

// ── Check if prize payment should route to guardian ────────────────────
// Rule 4: Prize payment to a minor routes to the verified guardian.
export function shouldRoutePrizeToGuardian(entry, consent): boolean {
  if (!entry || !entry.is_minor) return false;
  if (!consent || consent.status !== "granted") return false;
  return consent.scopes_prize_acceptance_payment === true;
}

// ── Withdraw consent: takedown, block future uses, audit-log ──────────
// Rule 5: Withdrawal removes public display, blocks future scope checks.
export async function withdrawConsent(sr, consent_id, actor, reason?: string) {
  const cid = String(consent_id);
  const now = new Date().toISOString();

  const consents = await sr.entities.GuardianConsent.filter(
    { id: cid }, "-created_date", 1
  ).catch(() => []);

  if (!consents || !consents.length) {
    return { withdrawn: false, error: "Consent record not found" };
  }

  const consent = consents[0];

  await sr.entities.GuardianConsent.update(cid, {
    status: "withdrawn",
    withdrawn_at: now,
    withdrawal_reason: reason || "",
  });

  // Update the entry's consent_status to withdrawn
  if (consent.entry_id) {
    const entries = await sr.entities.Entry.filter(
      { id: consent.entry_id }, "-created_date", 1
    ).catch(() => []);
    if (entries?.length) {
      await sr.entities.Entry.update(entries[0].id, {
        consent_status: "withdrawn",
      });
    }
  }

  await logAuditInline(sr, {
    event_type: "finding_waived",
    challenge_id: consent.challenge_id || "",
    actor_id: actor?.id || "",
    actor_email: actor?.email || "",
    detail: `Guardian consent ${cid} withdrawn${reason ? `: ${reason}` : ""}. Public display removed; future scope checks blocked.`,
  });

  return { withdrawn: true };
}

// ── Evaluate the accept_minors gate ─────────────────────────────────────
// Rule 6: accept_minors gate requires this workflow active and configured.
// Returns { can_pass, missing: [...] }
export async function evaluateAcceptMinorsGate(sr, challenge_id) {
  const cid = String(challenge_id);
  const missing: any[] = [];

  // 1. At least one active ConsentRequirement must exist for this challenge's
  //    context (global requirements apply to all challenges).
  const requirements = await sr.entities.ConsentRequirement.filter(
    { is_active: true }, "sort_order", 50
  ).catch(() => []);
  if (!requirements || !requirements.length) {
    missing.push({
      check: "consent_requirement",
      description: "At least one active ConsentRequirement must exist.",
    });
  }

  return { can_pass: missing.length === 0, missing };
}

// ── Get the effective consent for an entry ─────────────────────────────
// Returns the latest granted/withdrawn consent for the entry's participant.
export async function getConsentForEntry(sr, entry) {
  if (!entry || !entry.is_minor) return null;
  const consents = await sr.entities.GuardianConsent.filter(
    { challenge_id: String(entry.challenge_id), entry_id: String(entry.id) },
    "-created_date", 10
  ).catch(() => []);
  if (!consents || !consents.length) return null;
  // Return the most recent consent record
  return consents[0];
}

// ── Determine entry consent status from consent records ───────────────
export function deriveEntryConsentStatus(consent): string {
  if (!consent) return "pending_consent";
  if (consent.status === "withdrawn") return "withdrawn";
  if (consent.status === "granted" && hasMinimumConsent(consent)) return "valid";
  return "pending_consent";
}