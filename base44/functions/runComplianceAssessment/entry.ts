import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import {
  runAssessment, assembleFacts, logAudit, isSigned,
} from "../../shared/complianceAssessmentEngine.ts";
import { relockGatesWithOpenFindings } from "../../shared/lifecycleGateHelper.ts";
import { tryCrossRecognitionNT, createNotificationActions } from "../../shared/permitHelper.ts";

// Compliance Assessment Engine (Prompt 16) — backend function.
//
//   action: 'assess'              → { challenge_id, facts_override? }  run engine (admin)
//   action: 'get_assessment'      → { challenge_id } latest assessment   (admin)
//   action: 'list_findings'       → { challenge_id? assessment_id? }     (admin)
//   action: 'waive_finding'      → { finding_id, waiver_reason }        (compliance_officer/admin)
//   action: 'add_evidence'       → { finding_id, evidence_type, file_record?, description? } (admin)
//   action: 'list_triggers'      → all triggers                          (any authed)
//   action: 'list_rules'         → rules + current versions             (any authed)
//   action: 'list_jurisdictions' → all jurisdictions                    (any authed)
//   action: 'list_legal_positions' → all legal positions                (any authed)
//   action: 'create_rule'        → { code, name, jurisdiction_code, trigger_code, description? } (admin)
//   action: 'create_rule_version' → { rule_code, obligation_type, detail?, blocking?, satisfied_by?, condition_expression? } (admin)
//   action: 'sign_rule_version'  → { version_id, reviewer, date, reference } (admin)
//   action: 'list_audit_events'  → { challenge_id? }                     (admin)

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const action = body.action;
    const sr = base44.asServiceRole;
    const isAdmin = user.role === "admin" || user.is_admin === true;

    // ── Read-only actions (any authenticated user) ───────────────────
    if (action === "list_triggers") {
      const triggers = await sr.entities.ComplianceTrigger.list("-created_date", 200);
      return Response.json({ triggers: triggers || [] });
    }
    if (action === "list_jurisdictions") {
      const js = await sr.entities.Jurisdiction.list("-created_date", 50);
      return Response.json({ jurisdictions: js || [] });
    }
    if (action === "list_legal_positions") {
      const lps = await sr.entities.LegalPosition.list("-created_date", 50);
      return Response.json({ legal_positions: lps || [] });
    }
    if (action === "list_rules") {
      const rules = await sr.entities.RegulatoryRule.list("-created_date", 500);
      const versions = await sr.entities.RegulatoryRuleVersion.filter(
        { is_current: true }, "-created_date", 500
      ).catch(() => []);
      // Join current versions onto rules.
      const versionsByRule = {};
      for (const v of versions || []) {
        if (!versionsByRule[v.rule_code]) versionsByRule[v.rule_code] = [];
        versionsByRule[v.rule_code].push(v);
      }
      const joined = (rules || []).map((r) => ({
        ...r,
        versions: versionsByRule[r.code] || [],
        current_version: (versionsByRule[r.code] || []).find((v) => isSigned(v)) || null,
      }));
      return Response.json({ rules: joined });
    }

    // ── Assessment actions ───────────────────────────────────────────
    if (action === "assess") {
      if (!isAdmin) return Response.json({ error: "Admin only" }, { status: 403 });
      const challenge_id = String(body.challenge_id || "");
      if (!challenge_id) return Response.json({ error: "challenge_id required" }, { status: 400 });
      const result = await runAssessment(sr, challenge_id, body.facts_override, { id: user.id, email: user.email });
      // Rule 4: Re-lock gates that have open blocking findings after assessment.
      await relockGatesWithOpenFindings(sr, challenge_id, { id: user.id, email: user.email });

      // Prompt 18: Post-assessment permit checks
      // 1. Try NT cross-recognition for open NT permit_required findings
      const openNtFindings = await sr.entities.ComplianceAssessmentFinding.filter(
        { challenge_id, obligation_type: "permit_required", status: "open", jurisdiction_code: "NT" },
        "-created_date", 50
      ).catch(() => []);
      for (const f of openNtFindings || []) {
        await tryCrossRecognitionNT(sr, f, challenge_id, { id: user.id, email: user.email });
      }
      // 2. Create NSW notification actions for multi-year authority coverage
      const challenges = await sr.entities.Challenge.filter({ id: challenge_id }, "-created_date", 1).catch(() => []);
      const entryOpenDate = challenges?.[0]?.starts_at;
      await createNotificationActions(sr, challenge_id, entryOpenDate, { id: user.id, email: user.email });

      return Response.json({ result });
    }

    if (action === "get_assessment") {
      if (!isAdmin) return Response.json({ error: "Admin only" }, { status: 403 });
      const challenge_id = String(body.challenge_id || "");
      if (!challenge_id) return Response.json({ error: "challenge_id required" }, { status: 400 });
      const assessments = await sr.entities.ChallengeComplianceAssessment.filter(
        { challenge_id }, "-assessed_at", 1
      );
      return Response.json({ assessment: (assessments && assessments[0]) || null });
    }

    if (action === "list_findings") {
      if (!isAdmin) return Response.json({ error: "Admin only" }, { status: 403 });
      let findings;
      if (body.assessment_id) {
        findings = await sr.entities.ComplianceAssessmentFinding.filter(
          { assessment_id: String(body.assessment_id) }, "-created_date", 500
        );
      } else if (body.challenge_id) {
        findings = await sr.entities.ComplianceAssessmentFinding.filter(
          { challenge_id: String(body.challenge_id) }, "-created_date", 500
        );
      } else {
        findings = await sr.entities.ComplianceAssessmentFinding.list("-created_date", 500);
      }
      // Attach evidence for each finding.
      const out = [];
      for (const f of findings || []) {
        const evidence = await sr.entities.ObligationEvidence.filter(
          { finding_id: f.id }, "-recorded_at", 50
        ).catch(() => []);
        out.push({ ...f, evidence: evidence || [] });
      }
      return Response.json({ findings: out });
    }

    // ── Finding management ───────────────────────────────────────────
    if (action === "waive_finding") {
      if (!isAdmin) return Response.json({ error: "Compliance officer only" }, { status: 403 });
      const finding_id = String(body.finding_id || "");
      const reason = String(body.waiver_reason || "").trim();
      if (!finding_id) return Response.json({ error: "finding_id required" }, { status: 400 });
      // Rule 4: a waiver without a reason is impossible.
      if (!reason) return Response.json({ error: "waiver_reason is required" }, { status: 400 });

      const existing = await sr.entities.ComplianceAssessmentFinding.filter(
        { id: finding_id }, "-created_date", 1
      );
      const finding = existing && existing[0];
      if (!finding) return Response.json({ error: "Finding not found" }, { status: 404 });

      await sr.entities.ComplianceAssessmentFinding.update(finding_id, {
        status: "waived",
        waiver_reason: reason,
        waived_by: user.email,
        waived_at: new Date().toISOString(),
      });

      await logAudit(sr, {
        event_type: "finding_waived",
        challenge_id: finding.challenge_id,
        finding_id,
        actor_id: user.id,
        actor_email: user.email,
        detail: `Finding for rule ${finding.rule_code} waived. Reason: ${reason}`,
      });

      return Response.json({ ok: true, finding_id });
    }

    if (action === "add_evidence") {
      if (!isAdmin) return Response.json({ error: "Admin only" }, { status: 403 });
      const finding_id = String(body.finding_id || "");
      const evidence_type = String(body.evidence_type || "");
      if (!finding_id) return Response.json({ error: "finding_id required" }, { status: 400 });
      if (!evidence_type) return Response.json({ error: "evidence_type required" }, { status: 400 });

      const existing = await sr.entities.ComplianceAssessmentFinding.filter(
        { id: finding_id }, "-created_date", 1
      );
      const finding = existing && existing[0];
      if (!finding) return Response.json({ error: "Finding not found" }, { status: 404 });

      const ev = await sr.entities.ObligationEvidence.create({
        finding_id,
        evidence_type,
        file_record: String(body.file_record || ""),
        description: String(body.description || ""),
        recorded_by: user.email,
        recorded_at: new Date().toISOString(),
      });

      // Findings become satisfied ONLY via linked evidence matching satisfied_by.
      const versions = await sr.entities.RegulatoryRuleVersion.filter(
        { id: finding.rule_version_id }, "-created_date", 1
      ).catch(() => []);
      const version = versions && versions[0];

      let satisfied = false;
      if (version && version.satisfied_by === evidence_type) {
        await sr.entities.ComplianceAssessmentFinding.update(finding_id, { status: "satisfied" });
        satisfied = true;
      } else if (!version) {
        // No version found — can't verify satisfied_by, leave as-is.
      }

      await logAudit(sr, {
        event_type: "evidence_linked",
        challenge_id: finding.challenge_id,
        finding_id,
        actor_id: user.id,
        actor_email: user.email,
        detail: `Evidence (${evidence_type}) linked to finding for rule ${finding.rule_code}.${satisfied ? " Finding satisfied." : ""}`,
      });

      return Response.json({ ok: true, evidence_id: ev.id, satisfied });
    }

    // ── Rule CRUD ─────────────────────────────────────────────────────
    if (action === "create_rule") {
      if (!isAdmin) return Response.json({ error: "Admin only" }, { status: 403 });
      const { code, name, jurisdiction_code, trigger_code, description } = body;
      if (!code || !name || !jurisdiction_code) {
        return Response.json({ error: "code, name, jurisdiction_code required" }, { status: 400 });
      }
      // Check for duplicate code.
      const dup = await sr.entities.RegulatoryRule.filter({ code: String(code) }, "-created_date", 1);
      if (dup && dup.length) return Response.json({ error: "Rule code already exists" }, { status: 409 });
      const rule = await sr.entities.RegulatoryRule.create({
        code: String(code), name: String(name),
        jurisdiction_code: String(jurisdiction_code),
        trigger_code: String(trigger_code || ""),
        description: String(description || ""),
      });
      return Response.json({ rule });
    }

    if (action === "create_rule_version") {
      if (!isAdmin) return Response.json({ error: "Admin only" }, { status: 403 });
      const { rule_code, obligation_type, detail, blocking, satisfied_by, condition_expression } = body;
      if (!rule_code || !obligation_type) {
        return Response.json({ error: "rule_code, obligation_type required" }, { status: 400 });
      }
      const rule = await sr.entities.RegulatoryRule.filter({ code: String(rule_code) }, "-created_date", 1);
      if (!rule || !rule.length) return Response.json({ error: "Rule not found" }, { status: 404 });

      // Determine next version number.
      const existing = await sr.entities.RegulatoryRuleVersion.filter(
        { rule_code: String(rule_code) }, "-version_number", 1
      ).catch(() => []);
      const nextVersion = (existing && existing[0] ? (existing[0].version_number || 0) : 0) + 1;

      // Mark previous current versions as non-current.
      const prevVersions = await sr.entities.RegulatoryRuleVersion.filter(
        { rule_code: String(rule_code), is_current: true }, "-created_date", 100
      ).catch(() => []);
      for (const pv of prevVersions || []) {
        await sr.entities.RegulatoryRuleVersion.update(pv.id, { is_current: false });
      }

      const version = await sr.entities.RegulatoryRuleVersion.create({
        rule_code: String(rule_code),
        version_number: nextVersion,
        condition_expression: condition_expression || {},
        obligation_type: String(obligation_type),
        detail: String(detail || ""),
        blocking: blocking !== false,
        satisfied_by: String(satisfied_by || "evidence_item"),
        gate: String(body.gate || "publish"),
        effective_from: new Date().toISOString(),
        legal_signoff: {},
        is_current: true,
      });

      await logAudit(sr, {
        event_type: "rule_version_created",
        actor_id: user.id,
        actor_email: user.email,
        detail: `Version ${nextVersion} created for rule ${rule_code} (unsigned draft).`,
      });

      return Response.json({ version });
    }

    if (action === "sign_rule_version") {
      if (!isAdmin) return Response.json({ error: "Admin only" }, { status: 403 });
      const version_id = String(body.version_id || "");
      const reviewer = String(body.reviewer || "").trim();
      const date = String(body.date || "").trim();
      const reference = String(body.reference || "").trim();
      if (!version_id) return Response.json({ error: "version_id required" }, { status: 400 });
      if (!reviewer || !date || !reference) {
        return Response.json({ error: "reviewer, date, reference all required to sign" }, { status: 400 });
      }

      await sr.entities.RegulatoryRuleVersion.update(version_id, {
        legal_signoff: { reviewer, date, reference },
      });

      const versions = await sr.entities.RegulatoryRuleVersion.filter(
        { id: version_id }, "-created_date", 1
      );
      const version = versions && versions[0];

      await logAudit(sr, {
        event_type: "rule_signed",
        actor_id: user.id,
        actor_email: user.email,
        detail: `Rule version ${version?.rule_code} v${version?.version_number} signed by ${reviewer} (ref: ${reference}).`,
      });

      return Response.json({ ok: true, version_id, signed: true });
    }

    if (action === "list_audit_events") {
      if (!isAdmin) return Response.json({ error: "Admin only" }, { status: 403 });
      const filter = body.challenge_id ? { challenge_id: String(body.challenge_id) } : {};
      const events = await sr.entities.ComplianceAuditEvent.filter(filter, "-created_date", 200);
      return Response.json({ events: events || [] });
    }

    return Response.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}