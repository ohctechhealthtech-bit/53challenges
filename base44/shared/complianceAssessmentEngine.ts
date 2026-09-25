// Compliance Assessment Engine (Prompt 16)
//
// The versioned data layer that classifies every challenge and attaches
// obligations. Data-first: triggers, rule versions, legal positions, and
// findings are all editable DATA records — never hard-coded.
//
// KEY INVARIANTS:
//  - Only SIGNED rule versions (legal_signoff with reviewer + date + reference)
//    are evaluated. Unsigned versions are drafts the engine ignores.
//  - Findings become satisfied ONLY via linked ObligationEvidence, never a
//    bare checkbox.
//  - Waivers require a reason and are permanently audit-logged.
//  - No new attributes on Challenge — the engine reads existing records only.
//  - The interim compliance gate (Prompt 13) continues to block launches
//    independently of this engine.

// ── Condition evaluation ───────────────────────────────────────────────
// A condition is { field, operator, value }. The engine evaluates against a
// flat facts object assembled from existing records.
function evalCondition(cond, facts) {
  const val = facts[cond.field];
  const target = cond.value;
  switch (cond.operator) {
    case "eq": return val === target;
    case "ne": return val !== target;
    case "gt": return Number(val) > Number(target);
    case "gte": return Number(val) >= Number(target);
    case "lt": return Number(val) < Number(target);
    case "lte": return Number(val) <= Number(target);
    case "contains":
      if (Array.isArray(val)) return val.includes(target);
      if (typeof val === "string") return val.includes(String(target));
      return false;
    case "not_contains":
      if (Array.isArray(val)) return !val.includes(target);
      if (typeof val === "string") return !val.includes(String(target));
      return true;
    case "exists": return val !== undefined && val !== null && val !== "";
    default: return false;
  }
}

// All conditions must match (AND). No conditions = always true.
function evalConditions(conditions, facts) {
  if (!conditions || !Array.isArray(conditions) || !conditions.length) return true;
  return conditions.every((c) => evalCondition(c, facts));
}

// ── Fact assembly ──────────────────────────────────────────────────────
// Reads ONLY existing records — no new Challenge attributes. Derives nothing
// from a challenge's name.
export async function assembleFacts(sr, challenge_id, factsOverride) {
  const facts = { challenge_id: String(challenge_id), ...(factsOverride || {}) };

  // LaunchCompetition links the challenge to its assembled structure.
  const lc = await sr.entities.LaunchCompetition.filter(
    { challenge_id: String(challenge_id) }, "-created_date", 1
  ).catch(() => []);

  if (lc && lc.length) {
    const comp = lc[0];
    facts.geography = comp.geography || "national";
    facts.mechanic_slug = comp.mechanic || "";
    facts.scoring_model_slug = comp.scoring_model || "";
    facts.audience_slug = comp.audience || "";
    facts.participation_slug = comp.participation || "";
    facts.module_extensions = comp.module_extensions || [];

    // Fetch referenced entities by slug.
    if (comp.mechanic) {
      const mech = await sr.entities.ChallengeMechanic.filter(
        { slug: comp.mechanic }, "-created_date", 1
      ).catch(() => []);
      if (mech && mech.length) {
        facts.mechanic_name = mech[0].name;
        facts.mechanic_module_extensions = mech[0].module_extensions || [];
      }
    }
    if (comp.scoring_model) {
      const sm = await sr.entities.ScoringModel.filter(
        { slug: comp.scoring_model }, "-created_date", 1
      ).catch(() => []);
      if (sm && sm.length) {
        facts.scoring_automatic = sm[0].automatic;
        facts.scoring_judge_weight = sm[0].judge_weight;
        facts.scoring_public_weight = sm[0].public_weight;
        facts.scoring_judge_blind = sm[0].judge_blind;
      }
    }
    if (comp.audience) {
      const at = await sr.entities.AudienceType.filter(
        { slug: comp.audience }, "-created_date", 1
      ).catch(() => []);
      if (at && at.length) {
        facts.audience_name = at[0].name;
      }
    }
    if (comp.participation) {
      const pm = await sr.entities.ParticipationMode.filter(
        { slug: comp.participation }, "-created_date", 1
      ).catch(() => []);
      if (pm && pm.length) {
        facts.participation_name = pm[0].name;
      }
    }
  }

  // VotingConfiguration
  const vc = await sr.entities.VotingConfiguration.filter(
    { challenge_id: String(challenge_id) }, "-created_date", 1
  ).catch(() => []);
  if (vc && vc.length) {
    facts.voting_purpose = vc[0].voting_purpose || "";
    facts.voting_paid_voting = vc[0].paid_voting;
    facts.voting_identity_verification = vc[0].identity_verification || "";
  }

  // PromoterAppointment
  const pa = await sr.entities.PromoterAppointment.filter(
    { challenge_id: String(challenge_id) }, "-created_date", 1
  ).catch(() => []);
  if (pa && pa.length) {
    facts.promoter_type = pa[0].promoter_type || "";
  }

  // Prompt 21: ChallengeRightsConfiguration facts for trigger evaluation.
  const rc = await sr.entities.ChallengeRightsConfiguration.filter(
    { challenge_id: String(challenge_id) }, "-created_date", 1
  ).catch(() => []);
  if (rc && rc.length) {
    const cfg = rc[0];
    facts.rights_music_policy = cfg.music_policy || "original_or_licensed_only";
    facts.rights_third_party_policy = cfg.third_party_policy || "none_permitted";
    const includedScopes = (cfg.included_scope_versions || []).map((s) => s.scope_code);
    const tier2Scopes = ["platform_promotion", "challenge_recap", "social_repost"];
    const tier3Scopes = ["sponsor_host_use", "attribution", "non_sublicensable", "testimonial_nil", "derivative_compilation", "future_campaigns"];
    facts.rights_has_marketing_scopes = includedScopes.some((s) => tier2Scopes.includes(s) || tier3Scopes.includes(s));
    facts.rights_commercial_music_permitted = cfg.music_policy === "commercial_music_display_only";
    facts.rights_third_parties_expected = cfg.third_party_policy !== "none_permitted";
    facts.rights_ugc_marketing_use = facts.rights_has_marketing_scopes;
  }

  return facts;
}

// ── Trigger evaluation ─────────────────────────────────────────────────
export async function evaluateTriggers(sr, facts) {
  const triggers = await sr.entities.ComplianceTrigger.list("-created_date", 200).catch(() => []);
  const sorted = (triggers || []).slice().sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  const fired = [];
  for (const t of sorted) {
    const def = t.detection_definition || {};
    const conditions = def.conditions || [];
    if (evalConditions(conditions, facts)) {
      fired.push(t.code);
    }
  }
  return fired;
}

// ── Classification ─────────────────────────────────────────────────────
// no chance triggers → game_of_skill
// any chance trigger → game_of_chance or mixed
// voting per LegalPosition — with none active, determinative/weighted voting
//   classification requires_legal_opinion (blocking finding)
export async function classifyChallenge(sr, firedTriggers) {
  const hasChance = firedTriggers.includes("chance_element") || firedTriggers.includes("instant_win");
  const hasDeterminativeVoting = firedTriggers.includes("public_voting_determinative");
  const hasComponentVoting = firedTriggers.includes("public_voting_component");
  const hasVoting = hasDeterminativeVoting || hasComponentVoting;

  // Consult the active LegalPosition on public voting.
  const positions = await sr.entities.LegalPosition.filter(
    { topic: "public_voting", is_active: true }, "-created_date", 5
  ).catch(() => []);
  const votingPosition = positions && positions.length ? positions[0] : null;

  if (hasChance && hasVoting) return "mixed";
  if (hasChance) return "game_of_chance";

  if (hasVoting) {
    if (!votingPosition) return "requires_legal_opinion";
    if (votingPosition.position === "treat_as_chance") return "game_of_chance";
    if (votingPosition.position === "treat_as_skill") return "game_of_skill";
    return "requires_legal_opinion"; // case_by_case
  }

  return "game_of_skill";
}

// ── Rule version evaluation ────────────────────────────────────────────
// A version is signed when legal_signoff has reviewer + date + reference.
export function isSigned(version) {
  const ls = version?.legal_signoff;
  if (!ls || typeof ls !== "object") return false;
  return !!(ls.reviewer && ls.date && ls.reference &&
    String(ls.reviewer).trim() && String(ls.date).trim() && String(ls.reference).trim());
}

// Fetch signed, current rule versions whose trigger_code (if any) is among the
// fired triggers and whose condition_expression matches the challenge facts.
export async function findMatchingRuleVersions(sr, firedTriggers, facts) {
  const versions = await sr.entities.RegulatoryRuleVersion.filter(
    { is_current: true }, "-created_date", 500
  ).catch(() => []);
  const rules = await sr.entities.RegulatoryRule.list("-created_date", 500).catch(() => []);
  const ruleByCode = {};
  for (const r of rules || []) ruleByCode[r.code] = r;

  const matching = [];
  for (const v of versions || []) {
    if (!isSigned(v)) continue; // unsigned = draft, engine ignores

    const rule = ruleByCode[v.rule_code];
    if (!rule) continue;

    // If the rule responds to a trigger, that trigger must have fired.
    if (rule.trigger_code && !firedTriggers.includes(rule.trigger_code)) continue;

    // Evaluate condition_expression against the facts.
    const conditions = v.condition_expression?.conditions || [];
    if (evalConditions(conditions, facts)) {
      matching.push({ version: v, rule });
    }
  }
  return matching;
}

// ── Audit logging ──────────────────────────────────────────────────────
export async function logAudit(sr, evt) {
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

// ── Assessment runner ──────────────────────────────────────────────────
// Runs on every challenge save and on submission. Reads ONLY existing records.
export async function runAssessment(sr, challenge_id, factsOverride, actor) {
  const cid = String(challenge_id);

  // 1. Assemble facts from existing records.
  const facts = await assembleFacts(sr, cid, factsOverride);

  // 2. Evaluate triggers.
  const firedTriggers = await evaluateTriggers(sr, facts);

  // 3. Classify.
  const classification = await classifyChallenge(sr, firedTriggers);

  // 4. Find matching signed rule versions.
  const matching = await findMatchingRuleVersions(sr, firedTriggers, facts);
  const ruleVersionsUsed = matching.map((m) => m.version.id);

  // 5. Create assessment record.
  const assessment = await sr.entities.ChallengeComplianceAssessment.create({
    challenge_id: cid,
    fired_triggers: firedTriggers,
    classification,
    assessed_at: new Date().toISOString(),
    rule_versions_used: ruleVersionsUsed,
  });

  await logAudit(sr, {
    event_type: "assessment_run",
    challenge_id: cid,
    assessment_id: assessment.id,
    actor_id: actor?.id || "",
    actor_email: actor?.email || "",
    detail: `Classification: ${classification}. Triggers: ${firedTriggers.join(", ") || "none"}. Rule versions matched: ${matching.length}.`,
  });

  // 6. Manage findings.
  //    - Create new findings for newly matching rule versions.
  //    - Reopen findings whose underlying facts changed (rule version no longer
  //      matches but finding is still open/in_progress).
  const existingFindings = await sr.entities.ComplianceAssessmentFinding.filter(
    { challenge_id: cid, status: { $in: ["open", "in_progress"] } },
    "-created_date", 500
  ).catch(() => []);

  const existingByVersionId = {};
  for (const f of existingFindings || []) {
    existingByVersionId[f.rule_version_id] = f;
  }

  // Create new findings.
  const newFindings = [];
  for (const { version, rule } of matching) {
    if (!existingByVersionId[version.id]) {
      const finding = await sr.entities.ComplianceAssessmentFinding.create({
        assessment_id: assessment.id,
        challenge_id: cid,
        rule_version_id: version.id,
        rule_code: rule.code || version.rule_code,
        obligation_type: version.obligation_type || "",
        jurisdiction_code: rule.jurisdiction_code || "",
        gate: version.gate || "publish",
        blocking: version.blocking !== false,
        status: "open",
      });
      newFindings.push(finding);
      await logAudit(sr, {
        event_type: "finding_created",
        challenge_id: cid,
        assessment_id: assessment.id,
        finding_id: finding.id,
        actor_id: actor?.id || "",
        actor_email: actor?.email || "",
        detail: `Finding created for rule ${rule.code} (${version.obligation_type}). Blocking: ${version.blocking !== false}.`,
      });
    }
  }

  // Log re-evaluation for findings whose rule version no longer matches.
  const matchingVersionIds = new Set(matching.map((m) => m.version.id));
  for (const f of existingFindings || []) {
    if (!matchingVersionIds.has(f.rule_version_id)) {
      await logAudit(sr, {
        event_type: "finding_updated",
        challenge_id: cid,
        finding_id: f.id,
        actor_id: actor?.id || "",
        actor_email: actor?.email || "",
        detail: `Finding for rule ${f.rule_code} re-evaluated — underlying facts changed, rule version no longer matches.`,
      });
    }
  }

  return {
    assessment,
    fired_triggers: firedTriggers,
    classification,
    rule_versions_used: ruleVersionsUsed,
    findings_created: newFindings.length,
    findings_total: (existingFindings || []).length + newFindings.length,
  };
}