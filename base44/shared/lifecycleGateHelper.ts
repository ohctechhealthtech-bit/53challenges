// Lifecycle Gate Helper (Prompt 17)
//
// Replaces the single-approval model (interim Prompt 13 gate) with explicit
// stage gates. Each gate maps to a stage in the challenge lifecycle and is
// passed only when its named conditions are met. Every gate evaluation is
// recorded as a ComplianceAuditEvent with the conditions checked and a
// pass/fail result per condition.
//
// STAGE GATES (in order):
//   1. draft_to_review      — draft is complete enough to submit for review
//   2. review_to_approved   — PromoterAppointment present; a compliance
//                              assessment has been run with zero unresolved
//                              blocking findings; if voting determines the
//                              winner (or is a weighted component) a legal
//                              opinion reference is recorded; draft terms exist
//   3. approved_to_published — review_to_approved has passed (sequential)
//   4. entry_open            — approved_to_published has passed; published
//                              terms exist; no pending regulator notifications;
//                              no open blocking findings mapped to open_entry
//   5. voting_open           — entry_open has passed; a VotingConfiguration
//                              exists wherever voting is used; no open blocking
//                              findings mapped to open_voting
//
// KEY INVARIANTS:
//  - Rule 1: A challenge cannot move to approved without passing
//    review_to_approved (PromoterAppointment + zero unresolved blocking
//    findings + voting legal opinion).
//  - Rule 2: Existing published/live challenges are not unpublished or
//    altered by the evaluation pass — grandfathered-live challenges are
//    auto-passed up to their current phase to preserve live state.
//  - Rule 3: Every gate evaluation is audit-logged with conditions + pass/fail.
//  - Rule 4: Reopening a finding after an assessment re-locks the affected
//    stage gate even if previously passed.
//  - Rule 5: The interim launch_blocked field is preserved but becomes
//    read-only/historical once review_to_approved is passed; enforcement
//    uses lifecycle gates when GateCheck records exist, falling back to the
//    interim gate only for challenges not yet in the lifecycle system.

// Stage gates in lifecycle order (earliest → latest).
export const GATE_CODES = [
  "draft_to_review",
  "review_to_approved",
  "approved_to_published",
  "entry_open",
  "voting_open",
];

const STAGE_ORDER = {
  draft_to_review: 0,
  review_to_approved: 1,
  approved_to_published: 2,
  entry_open: 3,
  voting_open: 4,
};

// The lifecycle stage each gate unlocks on the native Challenge record.
const GATE_TO_LIFECYCLE_STATUS = {
  draft_to_review: "in_review",
  review_to_approved: "approved",
  approved_to_published: "published",
  entry_open: "entry_open",
  voting_open: "voting_open",
};
const LIFECYCLE_ORDER = [
  "draft", "in_review", "approved", "published", "entry_open", "voting_open", "closed",
];

const OPEN_FINDING_STATUSES = ["open", "in_progress"];
const VOTING_PURPOSES_REQUIRING_LEGAL = new Set(["determines_winner", "weighted_component"]);

// ── Audit logging (inlined — shared modules can't import each other) ──
async function logAudit(sr, evt) {
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

// ── Interim gate fallback (inlined from complianceGateHelper) ──────────
// Returns true when the write must be blocked. Align with Entry/vote:
// missing ComplianceGate fail-closes native challenges (not permitted).
async function isLaunchBlockedFallback(sr, challenge_id) {
  if (!challenge_id) return true;
  return await failClosedForUnassessed(sr, challenge_id);
}

// ── Helper: get the GateCheck for a challenge + gate code ───────────────
async function getGateCheck(sr, challenge_id, gate_code) {
  const checks = await sr.entities.GateCheck.filter(
    { challenge_id: String(challenge_id), gate_code }, "-created_date", 1
  ).catch(() => []);
  return (checks && checks[0]) || null;
}

// ── Helper: is a previous stage gate passed? (sequential dependency) ──
async function previousGatePassed(sr, challenge_id, gate_code) {
  const order = STAGE_ORDER[gate_code];
  if (order === undefined || order === 0) return true; // first gate
  const prevCode = GATE_CODES[order - 1];
  const check = await getGateCheck(sr, challenge_id, prevCode);
  return !!(check && check.status === "passed");
}

// ── Gate evaluation ───────────────────────────────────────────────────
// Returns { can_pass, conditions: [{check, description, passed}],
//           missing: [{check, description}], blocking_findings: [...] }
// `challengeData` is optional upstream challenge data (for draft completeness
// and voting-used detection); when absent, draft_to_review and voting-used
// checks are skipped (assumed satisfied).
export async function evaluateGate(sr, challenge_id, gate_code, challengeData) {
  const cid = String(challenge_id);
  const conditions = [];
  const blockingFindings = [];

  const addCondition = (check, description, passed) => {
    conditions.push({ check, description, passed: !!passed });
    if (!passed) conditions._missing = (conditions._missing || []).concat([{ check, description }]);
  };

  // 1. Find all blocking findings mapped to this gate's obligation scope.
  //    review_to_approved checks ALL blocking findings (any obligation gate);
  //    entry_open checks findings mapped to the open_entry obligation gate;
  //    voting_open checks findings mapped to the open_voting obligation gate.
  let findingGateFilter = null;
  if (gate_code === "review_to_approved") {
    findingGateFilter = null; // all blocking findings
  } else if (gate_code === "entry_open") {
    findingGateFilter = "open_entry";
  } else if (gate_code === "voting_open") {
    findingGateFilter = "open_voting";
  }

  if (findingGateFilter !== null) {
    const findings = await sr.entities.ComplianceAssessmentFinding.filter(
      { challenge_id: cid, gate: findingGateFilter, blocking: true },
      "-created_date", 500
    ).catch(() => []);
    for (const f of findings || []) {
      if (OPEN_FINDING_STATUSES.includes(f.status)) {
        blockingFindings.push(f);
        addCondition(`finding_${f.id}`, `Blocking finding for ${f.rule_code} (${f.obligation_type}) is ${f.status}.`, false);
      }
    }
  }

  // 2. Gate-specific structural + sequential conditions.
  switch (gate_code) {
    case "draft_to_review": {
      // Draft is complete enough to submit for review.
      const hasTheme = challengeData ? !!(challengeData.theme || challengeData.title) : true;
      const hasBrief = challengeData ? !!(challengeData.brief || challengeData.description) : true;
      const hasCategory = challengeData ? !!challengeData.category : true;
      addCondition("draft_theme", "Challenge theme/title is set.", hasTheme);
      addCondition("draft_brief", "Challenge brief is set.", hasBrief);
      addCondition("draft_category", "Challenge category is set.", hasCategory);
      break;
    }
    case "review_to_approved": {
      // Sequential: draft_to_review must have passed.
      const prevPassed = await previousGatePassed(sr, cid, gate_code);
      addCondition("draft_to_review_passed", "draft_to_review gate has passed.", prevPassed);

      // PromoterAppointment must exist.
      const pa = await sr.entities.PromoterAppointment.filter(
        { challenge_id: cid }, "-created_date", 1
      ).catch(() => []);
      addCondition("promoter_appointment", "PromoterAppointment record required.", !!(pa && pa.length));

      // A compliance assessment must have been run.
      const assessments = await sr.entities.ChallengeComplianceAssessment.filter(
        { challenge_id: cid }, "-assessed_at", 1
      ).catch(() => []);
      addCondition("assessment_run", "Compliance assessment has been run.", !!(assessments && assessments.length));

      // Zero unresolved blocking findings (any obligation gate).
      const allBlocking = await sr.entities.ComplianceAssessmentFinding.filter(
        { challenge_id: cid, blocking: true }, "-created_date", 500
      ).catch(() => []);
      const unresolved = (allBlocking || []).filter((f) => OPEN_FINDING_STATUSES.includes(f.status));
      addCondition(
        "zero_blocking_findings",
        "Zero unresolved blocking compliance findings.",
        unresolved.length === 0
      );
      for (const f of unresolved) {
        if (!blockingFindings.find((b) => b.id === f.id)) blockingFindings.push(f);
      }

      // If voting determines the winner / is a weighted component, a legal
      // opinion reference must be recorded.
      const vc = await sr.entities.VotingConfiguration.filter(
        { challenge_id: cid }, "-created_date", 1
      ).catch(() => []);
      if (vc && vc.length && VOTING_PURPOSES_REQUIRING_LEGAL.has(vc[0].voting_purpose)) {
        const ref = String(vc[0].legal_opinion_reference || "").trim();
        addCondition(
          "voting_legal_opinion",
          `VotingConfiguration.voting_purpose='${vc[0].voting_purpose}' requires a legal_opinion_reference.`,
          !!ref
        );
      }

      // Draft Terms & Conditions document must exist (Prompt 19, folded).
      const terms = await sr.entities.TermsDocument.filter(
        { challenge_id: cid, status: { $in: ["draft", "reviewed", "published"] } },
        "-created_date", 1
      ).catch(() => []);
      addCondition("terms_document", "Draft Terms & Conditions document required.", !!(terms && terms.length));
      break;
    }
    case "approved_to_published": {
      // Sequential: review_to_approved must have passed.
      const prevPassed = await previousGatePassed(sr, cid, gate_code);
      addCondition("review_to_approved_passed", "review_to_approved gate has passed.", prevPassed);

      // Kids/teens stay draft until guardians exist — never publish with those divisions.
      let divisions = Array.isArray(challengeData?.divisions) ? challengeData.divisions : null;
      if (!divisions) {
        try {
          const native = await sr.entities.Challenge.get(cid);
          divisions = native?.divisions || [];
        } catch { divisions = []; }
      }
      const hasKids = (divisions || []).some((d) => ["children", "teens"].includes(String(d || "").toLowerCase()));
      addCondition(
        "no_kids_teens_divisions",
        "Children/teens divisions cannot publish — remove them or keep the challenge draft until guardian consent is live.",
        !hasKids,
      );
      break;
    }
    case "entry_open": {
      // Sequential: approved_to_published must have passed.
      const prevPassed = await previousGatePassed(sr, cid, gate_code);
      addCondition("approved_to_published_passed", "approved_to_published gate has passed.", prevPassed);

      let entryDivisions = Array.isArray(challengeData?.divisions) ? challengeData.divisions : null;
      if (!entryDivisions) {
        try {
          const native = await sr.entities.Challenge.get(cid);
          entryDivisions = native?.divisions || [];
        } catch { entryDivisions = []; }
      }
      const entryHasKids = (entryDivisions || []).some((d) => ["children", "teens"].includes(String(d || "").toLowerCase()));
      addCondition(
        "no_kids_teens_divisions",
        "Children/teens divisions cannot open for entry — remove them or keep draft until guardian consent is live.",
        !entryHasKids,
      );

      // Published Terms & Conditions required before accepting entries (Prompt 19).
      const publishedTerms = await sr.entities.TermsDocument.filter(
        { challenge_id: cid, status: "published" },
        "-created_date", 1
      ).catch(() => []);
      addCondition("published_terms", "Published Terms & Conditions document required.", !!(publishedTerms && publishedTerms.length));

      // No pending/overdue notify_regulator actions (Prompt 18).
      const permitActions = await sr.entities.PermitAction.filter(
        { challenge_id: cid, action_type: "notify_regulator", status: { $in: ["pending", "overdue"] } },
        "-created_date", 50
      ).catch(() => []);
      addCondition(
        "no_pending_regulator_notifications",
        "No pending/overdue regulator notification actions.",
        (permitActions || []).length === 0
      );

      // Entry window must be defined and still open.
      if (challengeData) {
        const start = challengeData.starts_at ? new Date(challengeData.starts_at).getTime() : null;
        const subEnd = challengeData.submission_ends_at ? new Date(challengeData.submission_ends_at).getTime() : null;
        addCondition("entry_window_set", "Start and submission-close dates are set.", !!(start && subEnd));
        addCondition("entry_window_open", "The submission window has not already closed.", !!(subEnd && subEnd > Date.now()));
        addCondition("entry_window_started", "The start date has been reached.", !!(start && start <= Date.now()));
      }
      break;
    }
    case "voting_open": {
      // Sequential: entry_open must have passed.
      const prevPassed = await previousGatePassed(sr, cid, gate_code);
      addCondition("entry_open_passed", "entry_open gate has passed.", prevPassed);

      let voteDivisions = Array.isArray(challengeData?.divisions) ? challengeData.divisions : null;
      if (!voteDivisions) {
        try {
          const native = await sr.entities.Challenge.get(cid);
          voteDivisions = native?.divisions || [];
        } catch { voteDivisions = []; }
      }
      const voteHasKids = (voteDivisions || []).some((d) => ["children", "teens"].includes(String(d || "").toLowerCase()));
      addCondition(
        "no_kids_teens_divisions",
        "Children/teens divisions cannot open for voting — remove them or keep draft until guardian consent is live.",
        !voteHasKids,
      );

      // VotingConfiguration must exist wherever voting is used.
      const votingUsed = challengeData ? !!(challengeData.voting_ends_at || challengeData.voting_ends) : true;
      if (votingUsed) {
        const vc = await sr.entities.VotingConfiguration.filter(
          { challenge_id: cid }, "-created_date", 1
        ).catch(() => []);
        addCondition("voting_configuration", "VotingConfiguration record required (voting is used).", !!(vc && vc.length));
      }

      // Voting window must be defined, entries closed, and voting not yet over.
      if (challengeData) {
        const subEnd = challengeData.submission_ends_at ? new Date(challengeData.submission_ends_at).getTime() : null;
        const voteEnd = challengeData.voting_ends_at ? new Date(challengeData.voting_ends_at).getTime() : null;
        addCondition("voting_window_set", "Voting close date is set.", !!voteEnd);
        addCondition("entries_closed", "The submission window has closed.", !!(subEnd && subEnd <= Date.now()));
        addCondition("voting_window_open", "The voting window has not already closed.", !!(voteEnd && voteEnd > Date.now()));
      }
      break;
    }
    default:
      addCondition("unknown_gate", `Unknown gate '${gate_code}'.`, false);
  }

  const missing = conditions.filter((c) => !c.passed).map((c) => ({ check: c.check, description: c.description }));
  return { can_pass: missing.length === 0, conditions, missing, blocking_findings: blockingFindings };
}

// ── Pass a gate ────────────────────────────────────────────────────────
// Creates or updates a GateCheck to "passed". Audit-logs with actor.
// `grandfathered` (internal) marks a pass as grandfathered-live.
// Returns { passed, missing?, blocking_findings? }
export async function passGate(sr, challenge_id, gate_code, actor, opts) {
  const evalResult = await evaluateGate(sr, challenge_id, gate_code, opts?.challengeData);
  const allowGrandfathered = opts?.grandfathered === true;
  if (!evalResult.can_pass && !allowGrandfathered) {
    return { passed: false, missing: evalResult.missing, blocking_findings: evalResult.blocking_findings };
  }

  const cid = String(challenge_id);
  const now = new Date().toISOString();
  const grandfathered = !!allowGrandfathered;

  const existing = await getGateCheck(sr, cid, gate_code);
  if (existing) {
    await sr.entities.GateCheck.update(existing.id, {
      status: "passed",
      passed_at: now,
      passed_by_id: actor?.id || "",
      passed_by_email: actor?.email || "",
      grandfathered,
      relocked_reason: "",
      notes: grandfathered ? "Grandfathered live — challenge was live before the lifecycle gate system." : (existing.notes || ""),
    });
  } else {
    await sr.entities.GateCheck.create({
      challenge_id: cid,
      gate_code,
      status: "passed",
      passed_at: now,
      passed_by_id: actor?.id || "",
      passed_by_email: actor?.email || "",
      grandfathered,
      notes: grandfathered ? "Grandfathered live — challenge was live before the lifecycle gate system." : "",
    });
  }

  // Passing a gate advances the native challenge to the stage it unlocks.
  // Never regresses a challenge that is already further along.
  const targetStatus = GATE_TO_LIFECYCLE_STATUS[gate_code];
  if (targetStatus) {
    try {
      const challenge = await sr.entities.Challenge.get(cid);
      if (challenge) {
        const currentIdx = LIFECYCLE_ORDER.indexOf(challenge.lifecycle_status || "draft");
        const targetIdx = LIFECYCLE_ORDER.indexOf(targetStatus);
        if (targetIdx > currentIdx) {
          const patch: any = { lifecycle_status: targetStatus };
          // A published challenge is publicly visible, so it leaves draft status.
          if (targetIdx >= LIFECYCLE_ORDER.indexOf("published")) patch.status = "active";
          await sr.entities.Challenge.update(cid, patch);
        }
      }
    } catch { /* upstream challenge — no native record to advance */ }
  }

  await logAudit(sr, {
    event_type: "gate_passed",
    challenge_id: cid,
    actor_id: actor?.id || "",
    actor_email: actor?.email || "",
    detail: `Gate '${gate_code}' passed${grandfathered ? " (grandfathered live)" : ""}.`,
  });

  return { passed: true };
}

// ── Log a gate evaluation as an audit event ────────────────────────────
// Records the conditions checked and a pass/fail result per condition.
export async function logGateEvaluation(sr, challenge_id, gate_code, evalResult, actor) {
  const condSummary = (evalResult.conditions || [])
    .map((c) => `${c.check}=${c.passed ? "pass" : "fail"}`)
    .join("; ");
  await logAudit(sr, {
    event_type: "gate_evaluated",
    challenge_id: String(challenge_id),
    actor_id: actor?.id || "",
    actor_email: actor?.email || "system",
    detail: `Gate '${gate_code}' evaluated: ${evalResult.can_pass ? "PASS" : "FAIL"}. Conditions: ${condSummary}.`,
  });
}

// ── Re-lock gates with open blocking findings ──────────────────────────
// Rule 4: Reopening a finding after an assessment re-locks the affected
// stage gate even if previously passed. Called after every assessment.
export async function relockGatesWithOpenFindings(sr, challenge_id, actor) {
  const cid = String(challenge_id);

  const openFindings = await sr.entities.ComplianceAssessmentFinding.filter(
    { challenge_id: cid, blocking: true, status: { $in: OPEN_FINDING_STATUSES } },
    "-created_date", 500
  ).catch(() => []);

  if (!openFindings || !openFindings.length) return { relocked: [] };

  // Any open blocking finding re-locks review_to_approved (and every later
  // stage, since they depend on it). Findings mapped to a specific obligation
  // gate also re-lock the matching stage gate.
  const gatesToRelock = new Set(["review_to_approved"]);
  for (const f of openFindings) {
    if (f.gate === "open_entry") gatesToRelock.add("entry_open");
    if (f.gate === "open_voting") gatesToRelock.add("voting_open");
  }

  const relocked = [];
  for (const gate_code of gatesToRelock) {
    const existing = await getGateCheck(sr, cid, gate_code);
    if (existing && existing.status === "passed") {
      await sr.entities.GateCheck.update(existing.id, {
        status: "blocked",
        relocked_reason: "Open blocking finding detected during assessment re-evaluation.",
      });
      relocked.push(gate_code);
      await logAudit(sr, {
        event_type: "gate_relocked",
        challenge_id: cid,
        actor_id: actor?.id || "",
        actor_email: actor?.email || "",
        detail: `Gate '${gate_code}' re-locked: open blocking finding(s) detected.`,
      });
    }
  }

  return { relocked };
}

// ── Determine a challenge's lifecycle phase from its data ──────────────
// Returns "upcoming" | "submit" | "vote" | "closed".
export function challengePhase(challengeData) {
  if (!challengeData) return "closed";
  const now = Date.now();
  const start = challengeData.starts_at ? new Date(challengeData.starts_at).getTime() : null;
  const subEnd = challengeData.submission_ends_at ? new Date(challengeData.submission_ends_at).getTime() : null;
  const voteEnd = challengeData.voting_ends_at ? new Date(challengeData.voting_ends_at).getTime() : null;
  if (start && start > now) return "upcoming";
  if (subEnd && subEnd > now) return "submit";
  if (voteEnd && voteEnd > now) return "vote";
  return "closed";
}

// ── The set of stage gates a grandfathered-live challenge may auto-pass ──
// based on its current phase (preserves live state without republishing).
export function grandfatheredGatesForPhase(phase) {
  switch (phase) {
    case "submit": return ["draft_to_review", "review_to_approved", "approved_to_published", "entry_open"];
    case "vote":
    case "closed": return GATE_CODES.slice();
    default: return []; // upcoming — not live, evaluate strictly
  }
}

// ── Fail-closed default for native challenges ──────────────────────────
// A native challenge that is not in the lifecycle gate system and has no
// interim ComplianceGate record has never been assessed. "Not assessed"
// must mean DENIED, not permitted: an un-gated native challenge blocks
// entries and votes until an admin runs the gates. Upstream (archive)
// challenges are governed by the external API and keep the legacy
// permissive fallback so existing live competitions are unaffected.
async function isNativeChallenge(sr, challenge_id) {
  try {
    const c = await sr.entities.Challenge.get(String(challenge_id));
    return !!(c && c.source === "native");
  } catch {
    return false;
  }
}

// Returns true when the action must be blocked because no assessment exists.
async function failClosedForUnassessed(sr, challenge_id) {
  const cid = String(challenge_id);
  const gates = await sr.entities.ComplianceGate.filter(
    { challenge_id: cid }, "-created_date", 1
  ).catch(() => []);
  if (gates && gates.length) return gates[0].launch_blocked === true;
  // No GateCheck and no ComplianceGate at all.
  return await isNativeChallenge(sr, cid);
}

// ── Enforcement: is the challenge in the lifecycle gate system? ─────────
// Returns true if any GateCheck record exists for this challenge.
async function hasLifecycleGates(sr, challenge_id) {
  const cid = String(challenge_id);
  if (!cid) return false;
  const checks = await sr.entities.GateCheck.filter(
    { challenge_id: cid }, "-created_date", 1
  ).catch(() => []);
  return !!(checks && checks.length);
}

// ── Enforcement: is entry submission blocked? ──────────────────────────
// Lifecycle gates take precedence when GateCheck records exist. Otherwise
// falls back to the interim launch_blocked gate (backward compat).
export async function isEntryBlocked(sr, challenge_id) {
  const cid = String(challenge_id);
  if (!cid) return true; // no challenge => cannot verify => deny
  if (await hasLifecycleGates(sr, cid)) {
    const gc = await getGateCheck(sr, cid, "entry_open");
    return !(gc && gc.status === "passed");
  }
  return await failClosedForUnassessed(sr, cid);
}

// ── Enforcement: is voting blocked? ────────────────────────────────────
export async function isVoteBlocked(sr, challenge_id) {
  const cid = String(challenge_id);
  if (!cid) return true; // no challenge => cannot verify => deny
  if (await hasLifecycleGates(sr, cid)) {
    const gc = await getGateCheck(sr, cid, "voting_open");
    return !(gc && gc.status === "passed");
  }
  return await failClosedForUnassessed(sr, cid);
}

// ── Enforcement: is publishing blocked? ───────────────────────────────
export async function isPublishBlocked(sr, challenge_id) {
  const cid = String(challenge_id);
  if (!cid) return true; // no challenge => cannot verify => deny
  if (await hasLifecycleGates(sr, cid)) {
    const gc = await getGateCheck(sr, cid, "approved_to_published");
    return !(gc && gc.status === "passed");
  }
  // Same fail-closed path as Entry/vote when no lifecycle gates yet.
  return await failClosedForUnassessed(sr, cid);
}

// ── Has a challenge passed the review_to_approved gate? ────────────────
// Used to make the interim launch_blocked field read-only/historical.
export async function hasPassedReviewToApproved(sr, challenge_id) {
  const gc = await getGateCheck(sr, String(challenge_id), "review_to_approved");
  return !!(gc && gc.status === "passed");
}