import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { isValidPermit } from "../../shared/permitHelper.ts";
import { relockGatesWithOpenFindings } from "../../shared/lifecycleGateHelper.ts";

// Trade Promotion Permit Tracker (Prompt 18) — backend function.
//
//   action: 'list_permits'                → { challenge_id? }            (any authed)
//   action: 'create_permit'               → { jurisdiction_code, ... }   (admin)
//   action: 'update_permit'               → { permit_id, ...fields }     (admin)
//   action: 'list_actions'                → { challenge_id? }            (any authed)
//   action: 'create_action'              → { instrument_id?, ... }       (admin)
//   action: 'complete_action'            → { action_id, evidence? }     (admin)
//   action: 'link_permit_to_finding'      → { finding_id, permit_id }    (admin)
//   action: 'expire_check'               → {}                           (admin)
//   action: 'check_nt_cross_recognition' → { challenge_id }             (admin)

const PERMIT_EVIDENCE_TYPES = ["permit_record", "authority_reference"];

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const action = body.action;
    const sr = base44.asServiceRole;
    const isAdmin = user.role === "admin" || user.is_admin === true;

    // ── list_permits ──────────────────────────────────────────────────
    if (action === "list_permits") {
      let permits;
      if (body.challenge_id) {
        // Fetch all and filter by coverage (array containment)
        const all = await sr.entities.PermitOrAuthority.list("-created_date", 500);
        permits = (all || []).filter((p) =>
          !p.covered_challenges?.length || p.covered_challenges.includes(body.challenge_id)
        );
      } else {
        permits = await sr.entities.PermitOrAuthority.list("-created_date", 200);
      }
      return Response.json({ permits: permits || [] });
    }

    // ── create_permit ──────────────────────────────────────────────────
    if (action === "create_permit") {
      if (!isAdmin) return Response.json({ error: "Admin only" }, { status: 403 });
      const { jurisdiction_code, instrument_type, holder, reference_number,
              holder_entity_name, issued_date, effective_date, expiry_date,
              status, covered_challenges, fee, documents, notes } = body;
      if (!jurisdiction_code || !instrument_type || !holder || !reference_number) {
        return Response.json({ error: "jurisdiction_code, instrument_type, holder, reference_number required" }, { status: 400 });
      }
      const permit = await sr.entities.PermitOrAuthority.create({
        jurisdiction_code: String(jurisdiction_code),
        instrument_type: String(instrument_type),
        holder: String(holder),
        holder_entity_name: String(holder_entity_name || ""),
        reference_number: String(reference_number),
        issued_date: String(issued_date || ""),
        effective_date: String(effective_date || ""),
        expiry_date: String(expiry_date || ""),
        status: String(status || "applied"),
        covered_challenges: covered_challenges || [],
        fee: Number(fee) || 0,
        documents: documents || [],
        notes: String(notes || ""),
      });
      return Response.json({ permit });
    }

    // ── update_permit ─────────────────────────────────────────────────
    if (action === "update_permit") {
      if (!isAdmin) return Response.json({ error: "Admin only" }, { status: 403 });
      const permit_id = String(body.permit_id || "");
      if (!permit_id) return Response.json({ error: "permit_id required" }, { status: 400 });
      const updates = {};
      for (const k of ["status", "effective_date", "expiry_date", "covered_challenges", "fee", "notes", "documents", "assigned_to"]) {
        if (body[k] !== undefined) updates[k] = body[k];
      }
      const updated = await sr.entities.PermitOrAuthority.update(permit_id, updates);
      return Response.json({ permit: updated });
    }

    // ── list_actions ──────────────────────────────────────────────────
    if (action === "list_actions") {
      let actions;
      if (body.challenge_id) {
        actions = await sr.entities.PermitAction.filter(
          { challenge_id: String(body.challenge_id) }, "-created_date", 200
        );
      } else {
        actions = await sr.entities.PermitAction.list("-created_date", 200);
      }
      return Response.json({ actions: actions || [] });
    }

    // ── create_action ──────────────────────────────────────────────────
    if (action === "create_action") {
      if (!isAdmin) return Response.json({ error: "Admin only" }, { status: 403 });
      const { action_type, instrument_id, challenge_id, due_date, assigned_to, notes } = body;
      if (!action_type) return Response.json({ error: "action_type required" }, { status: 400 });
      const act = await sr.entities.PermitAction.create({
        action_type: String(action_type),
        instrument_id: String(instrument_id || ""),
        challenge_id: String(challenge_id || ""),
        due_date: String(due_date || ""),
        status: "pending",
        assigned_to: String(assigned_to || ""),
        notes: String(notes || ""),
      });
      return Response.json({ action: act });
    }

    // ── complete_action ────────────────────────────────────────────────
    if (action === "complete_action") {
      if (!isAdmin) return Response.json({ error: "Admin only" }, { status: 403 });
      const action_id = String(body.action_id || "");
      if (!action_id) return Response.json({ error: "action_id required" }, { status: 400 });
      const updated = await sr.entities.PermitAction.update(action_id, {
        status: "done",
        evidence: String(body.evidence || ""),
        completed_at: new Date().toISOString(),
      });
      return Response.json({ action: updated });
    }

    // ── link_permit_to_finding ────────────────────────────────────────
    // Rule 1: Linking an expired instrument does not satisfy a finding.
    if (action === "link_permit_to_finding") {
      if (!isAdmin) return Response.json({ error: "Admin only" }, { status: 403 });
      const finding_id = String(body.finding_id || "");
      const permit_id = String(body.permit_id || "");
      if (!finding_id || !permit_id) {
        return Response.json({ error: "finding_id and permit_id required" }, { status: 400 });
      }

      // Look up the permit
      const permits = await sr.entities.PermitOrAuthority.filter(
        { id: permit_id }, "-created_date", 1
      ).catch(() => []);
      const permit = permits?.[0];
      if (!permit) return Response.json({ error: "Permit not found" }, { status: 404 });

      // Look up the finding
      const findings = await sr.entities.ComplianceAssessmentFinding.filter(
        { id: finding_id }, "-created_date", 1
      ).catch(() => []);
      const finding = findings?.[0];
      if (!finding) return Response.json({ error: "Finding not found" }, { status: 404 });

      // Rule 1: Check validity — expired instruments do NOT satisfy
      const valid = isValidPermit(permit, finding.challenge_id);
      if (!valid) {
        // Still record the evidence, but do NOT mark as satisfied
        await sr.entities.ObligationEvidence.create({
          finding_id,
          evidence_type: "permit_record",
          file_record: permit_id,
          description: `Permit ${permit.reference_number} linked but INVALID (${permit.status}). Finding NOT satisfied.`,
          recorded_by: user.email,
          recorded_at: new Date().toISOString(),
        });
        return Response.json({
          ok: true, satisfied: false, valid: false,
          reason: `Permit is ${permit.status} or does not cover this challenge.`,
        });
      }

      // Valid permit — create evidence
      await sr.entities.ObligationEvidence.create({
        finding_id,
        evidence_type: "permit_record",
        file_record: permit_id,
        description: `Permit ${permit.reference_number} (${permit.jurisdiction_code}) linked as evidence.`,
        recorded_by: user.email,
        recorded_at: new Date().toISOString(),
      });

      // Check if the rule version's satisfied_by matches
      const versions = await sr.entities.RegulatoryRuleVersion.filter(
        { id: finding.rule_version_id }, "-created_date", 1
      ).catch(() => []);
      const version = versions?.[0];

      let satisfied = false;
      if (version && version.satisfied_by === "permit_record") {
        await sr.entities.ComplianceAssessmentFinding.update(finding_id, { status: "satisfied" });
        satisfied = true;
      }

      return Response.json({ ok: true, satisfied, valid: true });
    }

    // ── expire_check ──────────────────────────────────────────────────
    // Behaviour 4 + Rule 3: Check for expiring/expired instruments and
    // overdue actions. Re-locks gates on affected challenges.
    if (action === "expire_check") {
      if (!isAdmin) return Response.json({ error: "Admin only" }, { status: 403 });
      // Dynamic import to avoid circular shared-module issue
      const { checkExpiringInstruments } = await import("../../shared/permitHelper.ts");
      const result = await checkExpiringInstruments(sr, { id: user.id, email: user.email });

      // Re-lock gates on affected challenges
      for (const cid of result.affected_challenges) {
        await relockGatesWithOpenFindings(sr, cid, { id: user.id, email: user.email });
      }

      return Response.json(result);
    }

    // ── check_nt_cross_recognition ───────────────────────────────────
    if (action === "check_nt_cross_recognition") {
      if (!isAdmin) return Response.json({ error: "Admin only" }, { status: 403 });
      const challenge_id = String(body.challenge_id || "");
      if (!challenge_id) return Response.json({ error: "challenge_id required" }, { status: 400 });
      const { checkCrossRecognitionForChallenge } = await import("../../shared/permitHelper.ts");
      const result = await checkCrossRecognitionForChallenge(sr, challenge_id, { id: user.id, email: user.email });
      return Response.json(result);
    }

    return Response.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}