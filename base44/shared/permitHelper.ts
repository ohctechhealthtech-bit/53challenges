// Trade Promotion Permit Tracker (Prompt 18)
//
// Lifecycle management for permits/authorities/notifications, feeding
// evidence into compliance findings. Validity is checked at EVERY gate
// evaluation, not just at linking time.
//
// KEY INVARIANTS:
//  - Rule 1: Linking an expired instrument does not satisfy a finding.
//  - Rule 2: NSW notification action due date = 10 business days before
//    entry opens; blocks open_entry until done-with-evidence.
//  - Rule 3: Expiring an instrument re-locks gates on covered challenges.
//  - NT cross-recognition: an NT finding auto-satisfies when a valid permit
//    for the same challenge exists in another jurisdiction.
//  - Shared modules can't import each other — audit logging is inlined.

export const EXPIRY_LEAD_DAYS = 60;
export const NOTIFICATION_LEAD_BUSINESS_DAYS = 10;

// ── Inline audit logging ──────────────────────────────────────────────
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

// ── Business day computation ───────────────────────────────────────────
// Returns a YYYY-MM-DD date string N business days before the target date.
export function computeBusinessDaysBefore(targetDate, businessDays) {
  if (!targetDate) return null;
  const target = new Date(targetDate);
  let count = 0;
  const d = new Date(target);
  while (count < businessDays) {
    d.setDate(d.getDate() - 1);
    const day = d.getDay();
    if (day !== 0 && day !== 6) count++; // Skip Sat/Sun
  }
  return d.toISOString().split("T")[0];
}

// ── Permit validity check ─────────────────────────────────────────────
// Rule 1: An expired/refused/surrendered instrument is NOT valid.
// Checks status, dates, and challenge coverage.
export function isValidPermit(permit, challenge_id) {
  if (!permit) return false;
  if (!["active", "issued"].includes(permit.status)) return false;
  // Must cover the challenge (empty array = covers all)
  if (permit.covered_challenges?.length > 0 && !permit.covered_challenges.includes(challenge_id)) {
    return false;
  }
  // Must not be past expiry
  if (permit.expiry_date) {
    if (new Date(permit.expiry_date) < new Date()) return false;
  }
  // Must be effective (not future-dated)
  if (permit.effective_date) {
    if (new Date(permit.effective_date) > new Date()) return false;
  }
  return true;
}

// ── Re-check permit findings at gate evaluation ────────────────────────
// Behaviour 1: Validity/status/dates/jurisdiction coverage is checked at
// EVERY gate evaluation, not just at linking.
// Re-opens satisfied permit_required findings whose linked permits are
// no longer valid. The caller then re-locks affected gates.
export async function recheckPermitFindings(sr, challenge_id, actor) {
  const cid = String(challenge_id);
  const reopened = [];

  const findings = await sr.entities.ComplianceAssessmentFinding.filter(
    { challenge_id: cid, obligation_type: "permit_required", status: "satisfied" },
    "-created_date", 500
  ).catch(() => []);

  for (const f of findings || []) {
    const evidence = await sr.entities.ObligationEvidence.filter(
      { finding_id: f.id }, "-recorded_at", 50
    ).catch(() => []);

    let hasValidPermit = false;
    for (const ev of evidence || []) {
      if (!ev.file_record) continue;
      const permits = await sr.entities.PermitOrAuthority.filter(
        { id: ev.file_record }, "-created_date", 1
      ).catch(() => []);
      if (isValidPermit(permits?.[0], cid)) {
        hasValidPermit = true;
        break;
      }
    }

    if (!hasValidPermit) {
      await sr.entities.ComplianceAssessmentFinding.update(f.id, { status: "open" });
      reopened.push(f.id);
      await logAuditInline(sr, {
        event_type: "finding_updated",
        challenge_id: cid,
        finding_id: f.id,
        actor_id: actor?.id || "",
        actor_email: actor?.email || "",
        detail: `Permit-required finding for ${f.rule_code} re-opened: linked permit is no longer valid.`,
      });
    }
  }

  return { reopened: reopened.length };
}

// ── NSW notification action creation ───────────────────────────────────
// Behaviour 2 + Rule 2: A platform-held multi-year authority covering
// multiple challenges auto-creates a notify_regulator action due 10
// business days before entry opens. The open_entry gate blocks until
// done-with-evidence.
export async function createNotificationActions(sr, challenge_id, entry_open_date, actor) {
  const cid = String(challenge_id);

  // Find permit_required findings for NSW
  const findings = await sr.entities.ComplianceAssessmentFinding.filter(
    { challenge_id: cid, obligation_type: "permit_required", jurisdiction_code: "NSW" },
    "-created_date", 50
  ).catch(() => []);

  if (!findings || !findings.length) return { actions_created: 0 };

  // Find multi-year authorities covering this challenge for NSW
  const allPermits = await sr.entities.PermitOrAuthority.filter(
    { jurisdiction_code: "NSW", instrument_type: "authority_multiyear", status: { $in: ["active", "issued"] } },
    "-created_date", 200
  ).catch(() => []);

  const coveringPermits = (allPermits || []).filter((p) =>
    !p.covered_challenges?.length || p.covered_challenges.includes(cid)
  );

  if (!coveringPermits.length) return { actions_created: 0 };

  const dueDate = entry_open_date
    ? computeBusinessDaysBefore(entry_open_date, NOTIFICATION_LEAD_BUSINESS_DAYS)
    : null;

  let actionsCreated = 0;
  for (const permit of coveringPermits) {
    // Don't duplicate
    const existing = await sr.entities.PermitAction.filter(
      { instrument_id: permit.id, challenge_id: cid, action_type: "notify_regulator" },
      "-created_date", 1
    ).catch(() => []);
    if (existing?.length) continue;

    await sr.entities.PermitAction.create({
      instrument_id: permit.id,
      challenge_id: cid,
      action_type: "notify_regulator",
      due_date: dueDate,
      status: "pending",
      notes: `Auto-created: NSW multi-year authority ${permit.reference_number} covers this challenge.`,
    });
    actionsCreated++;
  }

  return { actions_created: actionsCreated };
}

// ── NT cross-recognition ──────────────────────────────────────────────
// Behaviour 3: An NT finding auto-satisfies when a valid permit for the
// same challenge exists in another jurisdiction, recording which instrument
// covers it.
export async function tryCrossRecognitionNT(sr, finding, challenge_id, actor) {
  const cid = String(challenge_id);
  if (!finding) return { recognized: false };
  if (finding.jurisdiction_code !== "NT") return { recognized: false };
  if (finding.obligation_type !== "permit_required") return { recognized: false };
  if (finding.status !== "open") return { recognized: false };

  // Find valid permits for this challenge in non-NT jurisdictions
  const allPermits = await sr.entities.PermitOrAuthority.filter(
    { status: { $in: ["active", "issued"] } }, "-created_date", 200
  ).catch(() => []);

  const coveringPermit = (allPermits || []).find((p) =>
    p.jurisdiction_code !== "NT" &&
    isValidPermit(p, cid)
  );

  if (!coveringPermit) return { recognized: false };

  // Record evidence of cross-recognition
  await sr.entities.ObligationEvidence.create({
    finding_id: finding.id,
    evidence_type: "authority_reference",
    file_record: coveringPermit.id,
    description: `NT cross-recognition: covered by ${coveringPermit.jurisdiction_code} permit ${coveringPermit.reference_number}.`,
    recorded_by: actor?.email || "system",
    recorded_at: new Date().toISOString(),
  });

  await sr.entities.ComplianceAssessmentFinding.update(finding.id, { status: "satisfied" });

  await logAuditInline(sr, {
    event_type: "evidence_linked",
    challenge_id: cid,
    finding_id: finding.id,
    actor_id: actor?.id || "",
    actor_email: actor?.email || "",
    detail: `NT finding for ${finding.rule_code} auto-satisfied via cross-recognition with ${coveringPermit.jurisdiction_code} permit ${coveringPermit.reference_number}.`,
  });

  return { recognized: true, permit_id: coveringPermit.id };
}

// ── Check all NT findings for a challenge ──────────────────────────────
export async function checkCrossRecognitionForChallenge(sr, challenge_id, actor) {
  const cid = String(challenge_id);
  const openFindings = await sr.entities.ComplianceAssessmentFinding.filter(
    { challenge_id: cid, obligation_type: "permit_required", status: "open", jurisdiction_code: "NT" },
    "-created_date", 50
  ).catch(() => []);

  const results = [];
  for (const f of openFindings || []) {
    const r = await tryCrossRecognitionNT(sr, f, cid, actor);
    results.push({ finding_id: f.id, ...r });
  }

  return { recognized: results.filter((r) => r.recognized).length, checked: results.length };
}

// ── Check expiring/expired instruments ────────────────────────────────
// Behaviour 4: expiring_soon at configurable lead (default 60 days);
// overdue actions escalate and re-lock affected gates.
// Rule 3: Expiring an instrument re-locks gates on its covered challenges.
//
// Returns affected challenge IDs — the caller calls relockGatesWithOpenFindings
// for each (shared modules can't import each other).
export async function checkExpiringInstruments(sr, actor) {
  const now = new Date();
  const leadDate = new Date();
  leadDate.setDate(leadDate.getDate() + EXPIRY_LEAD_DAYS);

  const allPermits = await sr.entities.PermitOrAuthority.filter(
    { status: { $in: ["active", "issued"] } }, "-created_date", 500
  ).catch(() => []);

  const expired = [];
  const expiringSoon = [];
  const affectedChallenges = new Set();

  for (const permit of allPermits || []) {
    if (!permit.expiry_date) continue;
    const expiry = new Date(permit.expiry_date);

    if (expiry < now) {
      // Expired — Rule 3: re-opens findings, re-locks gates
      await sr.entities.PermitOrAuthority.update(permit.id, { status: "expired" });
      expired.push(permit.id);
      for (const cid of permit.covered_challenges || []) {
        affectedChallenges.add(cid);
      }
      // Re-open satisfied findings linked to this permit
      await reopenFindingsForPermit(sr, permit, actor);
    } else if (expiry <= leadDate) {
      // Expiring soon
      await sr.entities.PermitOrAuthority.update(permit.id, { status: "expiring_soon" });
      expiringSoon.push(permit.id);
    }
  }

  // Check overdue actions
  const todayStr = now.toISOString().split("T")[0];
  const pendingActions = await sr.entities.PermitAction.filter(
    { status: "pending" }, "-created_date", 500
  ).catch(() => []);

  const overdueActions = [];
  for (const action of pendingActions || []) {
    if (action.due_date && action.due_date < todayStr) {
      await sr.entities.PermitAction.update(action.id, { status: "overdue" });
      overdueActions.push(action.id);
      if (action.challenge_id) affectedChallenges.add(action.challenge_id);
    }
  }

  return {
    expired: expired.length,
    expiring_soon: expiringSoon.length,
    overdue_actions: overdueActions.length,
    affected_challenges: Array.from(affectedChallenges),
  };
}

// ── Re-open findings linked to an expired permit ──────────────────────
async function reopenFindingsForPermit(sr, permit, actor) {
  const evidence = await sr.entities.ObligationEvidence.filter(
    { file_record: permit.id }, "-recorded_at", 50
  ).catch(() => []);

  for (const ev of evidence || []) {
    const findings = await sr.entities.ComplianceAssessmentFinding.filter(
      { id: ev.finding_id, status: "satisfied" }, "-created_date", 1
    ).catch(() => []);
    const finding = findings?.[0];
    if (finding) {
      await sr.entities.ComplianceAssessmentFinding.update(finding.id, { status: "open" });
      await logAuditInline(sr, {
        event_type: "finding_updated",
        challenge_id: finding.challenge_id,
        finding_id: finding.id,
        actor_id: actor?.id || "",
        actor_email: actor?.email || "",
        detail: `Finding for ${finding.rule_code} re-opened: permit ${permit.reference_number} has expired.`,
      });
    }
  }
}