import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import {
  MINIMUM_SCOPES, ALL_SCOPES,
  hasMinimumConsent, isEntryVisibleToPublic, isEntryValidForJudging,
  maskMinorName, getEligibilityBracket, shouldRoutePrizeToGuardian,
  withdrawConsent, evaluateAcceptMinorsGate, getConsentForEntry,
  deriveEntryConsentStatus,
} from "../../shared/guardianConsentHelper.ts";

// Guardian Consent (Prompt 20) — backend function.
//
//   action: 'list_requirements'        → list ConsentRequirement reference data (any authed)
//   action: 'create_requirement'       → create a consent requirement (admin)
//   action: 'list_consents'            → { challenge_id } list consent records (any authed)
//   action: 'get_consent'               → { consent_id } get a consent record (any authed)
//   action: 'create_consent'            → create a consent record (any authed)
//   action: 'grant_consent'             → { consent_id, scopes } grant with scopes (admin)
//   action: 'decline_consent'          → { consent_id } decline (admin)
//   action: 'withdraw_consent'         → { consent_id, reason } withdraw + takedown (admin)
//   action: 'check_entry_visibility'   → { entry_id } check public/judging visibility (any authed)
//   action: 'evaluate_minors_gate'     → { challenge_id } evaluate accept_minors gate (any authed)

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const action = body.action;
    const sr = base44.asServiceRole;
    const isAdmin = user.role === "admin" || user.is_admin === true;

    // ── list_requirements ────────────────────────────────────────────
    if (action === "list_requirements") {
      const requirements = await sr.entities.ConsentRequirement.list("sort_order", 50);
      return Response.json({ requirements: requirements || [] });
    }

    // ── create_requirement (admin) ───────────────────────────────────
    if (action === "create_requirement") {
      if (!isAdmin) return Response.json({ error: "Admin only" }, { status: 403 });
      const { name, method, clause_reference, description, sort_order } = body;
      if (!name || !method) {
        return Response.json({ error: "name and method required" }, { status: 400 });
      }
      const req = await sr.entities.ConsentRequirement.create({
        name, method, clause_reference: clause_reference || "",
        description: description || "", sort_order: sort_order || 0,
      });
      return Response.json({ ok: true, requirement: req });
    }

    // ── list_consents ─────────────────────────────────────────────────
    if (action === "list_consents") {
      const challenge_id = String(body.challenge_id || "");
      if (!challenge_id) return Response.json({ error: "challenge_id required" }, { status: 400 });
      const consents = await sr.entities.GuardianConsent.filter(
        { challenge_id }, "-created_date", 200
      ).catch(() => []);
      return Response.json({ consents: consents || [] });
    }

    // ── get_consent ──────────────────────────────────────────────────
    if (action === "get_consent") {
      const consent_id = String(body.consent_id || "");
      if (!consent_id) return Response.json({ error: "consent_id required" }, { status: 400 });
      const consents = await sr.entities.GuardianConsent.filter(
        { id: consent_id }, "-created_date", 1
      ).catch(() => []);
      if (!consents || !consents.length) {
        return Response.json({ error: "Consent not found" }, { status: 404 });
      }
      return Response.json({ consent: consents[0] });
    }

    // ── create_consent ───────────────────────────────────────────────
    if (action === "create_consent") {
      const {
        challenge_id, entry_id, participant_name, participant_email,
        requirement_id, guardian_name, guardian_relationship,
        guardian_contact, method_used, consent_wording_hash,
      } = body;
      if (!challenge_id || !participant_name || !guardian_name || !requirement_id) {
        return Response.json({ error: "challenge_id, participant_name, guardian_name, requirement_id required" }, { status: 400 });
      }
      const consent = await sr.entities.GuardianConsent.create({
        challenge_id: String(challenge_id),
        entry_id: entry_id || "",
        participant_name, participant_email: participant_email || "",
        requirement_id: String(requirement_id),
        requirement_version: body.requirement_version || 1,
        guardian_name, guardian_relationship: guardian_relationship || "",
        guardian_contact: guardian_contact || "",
        method_used: method_used || "guardian_email_verification",
        status: "pending",
        consent_wording_hash: consent_wording_hash || "",
      });
      return Response.json({ ok: true, consent });
    }

    // ── grant_consent (admin) ─────────────────────────────────────────
    if (action === "grant_consent") {
      if (!isAdmin) return Response.json({ error: "Admin only" }, { status: 403 });
      const consent_id = String(body.consent_id || "");
      const scopes = body.scopes || {};
      if (!consent_id) return Response.json({ error: "consent_id required" }, { status: 400 });

      const consents = await sr.entities.GuardianConsent.filter(
        { id: consent_id }, "-created_date", 1
      ).catch(() => []);
      if (!consents || !consents.length) {
        return Response.json({ error: "Consent not found" }, { status: 404 });
      }
      const consent = consents[0];

      const update: any = {
        status: "granted",
        verified_at: new Date().toISOString(),
      };
      // Apply all scope fields from the body
      for (const scope of ALL_SCOPES) {
        if (scopes[scope] !== undefined) {
          update[scope] = !!scopes[scope];
        }
      }

      await sr.entities.GuardianConsent.update(consent_id, update);

      // Update entry consent_status if entry is linked
      if (consent.entry_id) {
        const updatedConsent = { ...consent, ...update };
        const status = deriveEntryConsentStatus(updatedConsent);
        await sr.entities.Entry.update(consent.entry_id, { consent_status: status }).catch(() => {});
      }

      return Response.json({ ok: true, consent_id, status: "granted" });
    }

    // ── decline_consent (admin) ───────────────────────────────────────
    if (action === "decline_consent") {
      if (!isAdmin) return Response.json({ error: "Admin only" }, { status: 403 });
      const consent_id = String(body.consent_id || "");
      if (!consent_id) return Response.json({ error: "consent_id required" }, { status: 400 });
      await sr.entities.GuardianConsent.update(consent_id, {
        status: "declined",
        verified_at: new Date().toISOString(),
      });
      return Response.json({ ok: true, consent_id, status: "declined" });
    }

    // ── withdraw_consent (admin) ─────────────────────────────────────
    if (action === "withdraw_consent") {
      if (!isAdmin) return Response.json({ error: "Admin only" }, { status: 403 });
      const consent_id = String(body.consent_id || "");
      const reason = String(body.reason || "");
      if (!consent_id) return Response.json({ error: "consent_id required" }, { status: 400 });
      const result = await withdrawConsent(sr, consent_id, { id: user.id, email: user.email }, reason);
      if (!result.withdrawn) {
        return Response.json({ error: result.error || "Withdrawal failed" }, { status: 400 });
      }
      return Response.json({ ok: true, consent_id, status: "withdrawn" });
    }

    // ── check_entry_visibility ───────────────────────────────────────
    if (action === "check_entry_visibility") {
      const entry_id = String(body.entry_id || "");
      if (!entry_id) return Response.json({ error: "entry_id required" }, { status: 400 });
      const entries = await sr.entities.Entry.filter(
        { id: entry_id }, "-created_date", 1
      ).catch(() => []);
      if (!entries || !entries.length) {
        return Response.json({ error: "Entry not found" }, { status: 404 });
      }
      const entry = entries[0];
      const consent = await getConsentForEntry(sr, entry);
      return Response.json({
        entry_id,
        is_minor: entry.is_minor,
        consent_status: entry.consent_status || "pending_consent",
        visible_to_public: isEntryVisibleToPublic(entry, consent),
        valid_for_judging: isEntryValidForJudging(entry, consent),
        display_name: entry.is_minor ? maskMinorName(entry.creator_name) : entry.creator_name,
        eligibility_bracket: entry.is_minor ? getEligibilityBracket(entry) : null,
        prize_routes_to_guardian: shouldRoutePrizeToGuardian(entry, consent),
        has_minimum_consent: hasMinimumConsent(consent),
      });
    }

    // ── evaluate_minors_gate ─────────────────────────────────────────
    if (action === "evaluate_minors_gate") {
      const challenge_id = String(body.challenge_id || "");
      if (!challenge_id) return Response.json({ error: "challenge_id required" }, { status: 400 });
      const result = await evaluateAcceptMinorsGate(sr, challenge_id);
      return Response.json({ evaluation: result });
    }

    return Response.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}