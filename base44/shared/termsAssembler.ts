// Terms Assembler (Prompt 19)
//
// Assembles Terms & Conditions from lawyer-approved clauses ONLY.
// The assembler is an assembly engine, never a legal writer.
//
// KEY INVARIANTS:
//  - Only SIGNED clauses (legal_signoff with reviewer + date + reference)
//    are selectable. Unsigned = draft, the assembler ignores it.
//  - STOP conditions halt assembly and route to legal review.
//  - Published documents are immutable; material changes create new versions.
//  - An unsigned clause version can NEVER be selected (Rule 2).
//  - Chance-classified challenges halt if permit_numbers is empty (Rule 1).

// ── Condition evaluation (inlined — shared modules can't import each other) ──
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

function evalConditions(conditions, facts) {
  if (!conditions || !Array.isArray(conditions) || !conditions.length) return true;
  return conditions.every((c) => evalCondition(c, facts));
}

// ── Audit logging (inlined) ─────────────────────────────────────────────
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

// ── Clause sign-off checks ─────────────────────────────────────────────
export function isClauseSigned(clause) {
  const ls = clause?.legal_signoff;
  if (!ls || typeof ls !== "object") return false;
  return !!(
    ls.reviewer && ls.date && ls.reference &&
    String(ls.reviewer).trim() && String(ls.date).trim() && String(ls.reference).trim()
  );
}

export function isClauseExpired(clause) {
  if (!clause?.retirement_date) return false;
  try {
    return new Date(clause.retirement_date) <= new Date();
  } catch {
    return false;
  }
}

// ── Required categories based on challenge config ──────────────────────
function getRequiredCategories(facts, classification) {
  const required = new Set([
    "promoter_identity", "eligibility", "entry_method",
    "prizes", "privacy", "liability", "disputes", "general",
  ]);

  // Judging required if judge-based scoring
  if (Number(facts.scoring_judge_weight) > 0) required.add("judging");

  // Voting required if voting is configured
  if (facts.voting_purpose) required.add("voting");

  // Permit/draw/free-entry required for chance games
  if (classification === "game_of_chance" || classification === "mixed") {
    required.add("permit_statements");
    required.add("draw_procedure");
    required.add("free_entry_route");
  }

  // Minors required if audience includes minors
  if (facts.audience_slug === "minors" || facts.audience_slug === "all_ages") {
    required.add("minors");
  }

  // Rights grants required if voting or judging
  if (facts.voting_purpose || Number(facts.scoring_judge_weight) > 0) {
    required.add("rights_grants");
  }

  return required;
}

// ── Clause selection ───────────────────────────────────────────────────
// Selects signed, current, non-expired clauses: mandatory always,
// conditional when inclusion_rule conditions match facts.
export async function selectClauses(sr, facts) {
  const allClauses = await sr.entities.ApprovedClause.filter(
    { is_current: true }, "-created_date", 500
  ).catch(() => []);

  const selected = [];
  const skipErrors = [];

  for (const c of allClauses || []) {
    // Rule 2 / STOP 4: unsigned clauses cannot be selected
    if (!isClauseSigned(c)) {
      if (c.mandatory) {
        skipErrors.push({
          stop: "clause_unsigned",
          detail: `Mandatory clause '${c.identifier}' is unsigned and cannot be selected.`,
        });
      }
      continue;
    }

    // STOP 4: expired clauses cannot be selected
    if (isClauseExpired(c)) {
      if (c.mandatory) {
        skipErrors.push({
          stop: "clause_expired",
          detail: `Mandatory clause '${c.identifier}' is expired (retirement_date: ${c.retirement_date}).`,
        });
      }
      continue;
    }

    // Jurisdiction filter: if clause has jurisdictions, challenge must match
    if (c.applicable_jurisdictions && c.applicable_jurisdictions.length) {
      const challengeJurisdiction = facts.jurisdiction_code || facts.geography || "";
      if (challengeJurisdiction && !c.applicable_jurisdictions.includes(challengeJurisdiction)) {
        continue; // not applicable to this jurisdiction
      }
    }

    // Mandatory clauses always selected
    if (c.mandatory) {
      selected.push(c);
      continue;
    }

    // Conditional: evaluate inclusion_rule conditions
    const conditions = c.inclusion_rule?.conditions || [];
    if (evalConditions(conditions, facts)) {
      selected.push(c);
    }
  }

  return { selected, skipErrors };
}

// ── Merge variable resolution ───────────────────────────────────────────
export async function resolveVariables(sr, challenge_id, facts, overrides) {
  const cid = String(challenge_id);
  const vars = { ...facts, ...(overrides || {}) };

  // Challenge record
  const challenges = await sr.entities.Challenge.filter({ id: cid }, "-created_date", 1).catch(() => []);
  const challenge = challenges?.[0];
  if (challenge) {
    if (!vars.challenge_name) vars.challenge_name = challenge.title || "";
    if (!vars.entry_open) vars.entry_open = challenge.starts_at || "";
    if (!vars.entry_close) vars.entry_close = challenge.submission_ends_at || "";
    if (!vars.draw_date_time) vars.draw_date_time = challenge.voting_ends_at || "";
  }

  // Promoter entity
  if (!vars.promoter_entity) {
    const pa = await sr.entities.PromoterAppointment.filter(
      { challenge_id: cid }, "-created_date", 1
    ).catch(() => []);
    if (pa?.length) {
      vars.promoter_entity = pa[0].promoter_entity_name || "";
    }
  }
  if (!vars.host_name) vars.host_name = vars.promoter_entity || "";

  // Permit numbers
  if (!vars.permit_numbers) {
    const allPermits = await sr.entities.PermitOrAuthority.list("-created_date", 200).catch(() => []);
    const coveringPermits = (allPermits || []).filter((p) =>
      !p.covered_challenges?.length || p.covered_challenges.includes(cid)
    );
    const validPermits = coveringPermits.filter((p) =>
      p.status === "active" || p.status === "issued"
    );
    vars.permit_numbers = validPermits.map((p) => p.reference_number).filter(Boolean).join(", ");
  }

  // Voting configuration
  if (!vars.eligible_states || !vars.voting_rules_summary) {
    const vc = await sr.entities.VotingConfiguration.filter(
      { challenge_id: cid }, "-created_date", 1
    ).catch(() => []);
    if (vc?.length) {
      if (!vars.eligible_states) {
        vars.eligible_states = (vc[0].geographic_restrictions || []).join(", ");
      }
      if (!vars.voting_rules_summary) {
        vars.voting_rules_summary =
          `Voting purpose: ${vc[0].voting_purpose}. ` +
          `Votes per person: ${vc[0].votes_per_person_per_account}. ` +
          `Identity verification: ${vc[0].identity_verification}.`;
      }
    }
  }

  // Prompt 21: Pull rights summary from ChallengeRightsConfiguration.
  if (!vars.rights_summary) {
    const rc = await sr.entities.ChallengeRightsConfiguration.filter(
      { challenge_id: cid }, "-created_date", 1
    ).catch(() => []);
    if (rc?.length) {
      const cfg = rc[0];
      const tiers = (cfg.included_scope_versions || []).reduce((acc, s) => {
        const tier = s.tier || "tier1_mandatory";
        if (!acc[tier]) acc[tier] = [];
        acc[tier].push(s.scope_code);
        return acc;
      }, {});
      const parts = [];
      if (tiers.tier1_mandatory?.length) parts.push(`Mandatory: ${tiers.tier1_mandatory.join(", ")}`);
      if (tiers.tier2_standard?.length) parts.push(`Standard (declinable): ${tiers.tier2_standard.join(", ")}`);
      if (tiers.tier3_extended?.length) parts.push(`Extended (opt-in): ${tiers.tier3_extended.join(", ")}`);
      parts.push(`Music: ${cfg.music_policy || "original_or_licensed_only"}`);
      parts.push(`Third parties: ${cfg.third_party_policy || "none_permitted"}`);
      vars.rights_summary = parts.join(". ");
    }
  }

  // Defaults for unresolvable variables
  vars.winner_notification_method = vars.winner_notification_method || "Email and phone";
  vars.results_publication = vars.results_publication || "Published on the 53 Challenges website";
  vars.rights_summary = vars.rights_summary || "As specified in the competition rules";
  vars.min_age = vars.min_age || "18";
  vars.judging_criteria = vars.judging_criteria || "As specified in the scoring model";
  vars.prize_descriptions = vars.prize_descriptions ||
    (vars.total_prize_pool ? `Total prize pool: $${vars.total_prize_pool}` : "As specified in the competition brief");

  return vars;
}

// ── Variable merging into clause body ──────────────────────────────────
function mergeVariables(body, vars) {
  let result = String(body || "");
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), String(value ?? ""));
  }
  return result;
}

// ── Supersede a TermsDocument ──────────────────────────────────────────
export async function supersedeDocument(sr, doc_id, newDocId, reason, actor) {
  await sr.entities.TermsDocument.update(doc_id, {
    status: "superseded",
    superseded_by: newDocId,
    change_note: reason,
  });

  await logAudit(sr, {
    event_type: "assessment_run",
    challenge_id: "",
    actor_id: actor?.id || "",
    actor_email: actor?.email || "",
    detail: `TermsDocument ${doc_id} superseded. Reason: ${reason}`,
  });
}

// ── Reopen findings that depended on published terms ───────────────────
async function reopenTermsFindings(sr, challenge_id, actor) {
  const findings = await sr.entities.ComplianceAssessmentFinding.filter(
    {
      challenge_id: String(challenge_id),
      obligation_type: { $in: ["legal_review_required", "tandc_clause_required"] },
    },
    "-created_date", 50
  ).catch(() => []);

  let reopened = 0;
  for (const f of findings || []) {
    if (f.status === "satisfied" || f.status === "waived") {
      await sr.entities.ComplianceAssessmentFinding.update(f.id, { status: "open" });
      reopened++;
      await logAudit(sr, {
        event_type: "finding_updated",
        challenge_id: String(challenge_id),
        finding_id: f.id,
        actor_id: actor?.id || "",
        actor_email: actor?.email || "",
        detail: `Finding for rule ${f.rule_code} reopened — terms document superseded.`,
      });
    }
  }
  return reopened;
}

// ── Build config snapshot ──────────────────────────────────────────────
function buildConfigSnapshot(facts, classification) {
  return {
    classification,
    voting_purpose: facts.voting_purpose || "",
    total_prize_pool: Number(facts.total_prize_pool) || 0,
    promoter_type: facts.promoter_type || "",
    scoring_model_slug: facts.scoring_model_slug || "",
    audience_slug: facts.audience_slug || "",
    mechanic_slug: facts.mechanic_slug || "",
  };
}

// ── Check if config changed since last document ────────────────────────
function detectConfigChange(snapshot, currentFacts, currentClassification) {
  if (!snapshot) return { changed: false, fields: [] };

  const fields = [];
  if (snapshot.classification && snapshot.classification !== currentClassification) {
    fields.push("classification");
  }
  if (snapshot.voting_purpose !== undefined && snapshot.voting_purpose !== (currentFacts.voting_purpose || "")) {
    fields.push("voting_purpose");
  }
  if (snapshot.total_prize_pool !== undefined &&
      Number(snapshot.total_prize_pool) !== Number(currentFacts.total_prize_pool || 0)) {
    fields.push("total_prize_pool");
  }
  if (snapshot.promoter_type && snapshot.promoter_type !== (currentFacts.promoter_type || "")) {
    fields.push("promoter_type");
  }
  if (snapshot.scoring_model_slug && snapshot.scoring_model_slug !== (currentFacts.scoring_model_slug || "")) {
    fields.push("scoring_model_slug");
  }
  if (snapshot.audience_slug && snapshot.audience_slug !== (currentFacts.audience_slug || "")) {
    fields.push("audience_slug");
  }
  if (snapshot.mechanic_slug && snapshot.mechanic_slug !== (currentFacts.mechanic_slug || "")) {
    fields.push("mechanic_slug");
  }

  return { changed: fields.length > 0, fields };
}

// ── Main assembly function ──────────────────────────────────────────────
// Returns { document?, errors: [...], warnings: [...], clauses_used?, classification? }
export async function assembleTerms(sr, challenge_id, facts, actor) {
  const cid = String(challenge_id);
  const errors = [];
  const warnings = [];

  // Get latest assessment for classification
  const assessments = await sr.entities.ChallengeComplianceAssessment.filter(
    { challenge_id: cid }, "-assessed_at", 1
  ).catch(() => []);
  const assessment = assessments?.[0];
  const classification = assessment?.classification || facts.classification || "game_of_skill";

  // ── STOP 5: Config changed after generation ──────────────────────────
  const existingDocs = await sr.entities.TermsDocument.filter(
    { challenge_id: cid, status: { $in: ["draft", "reviewed", "published"] } },
    "-created_date", 10
  ).catch(() => []);

  if (existingDocs?.length) {
    const latestDoc = existingDocs[0];
    if (latestDoc.config_snapshot && Object.keys(latestDoc.config_snapshot).length) {
      const changeResult = detectConfigChange(latestDoc.config_snapshot, facts, classification);
      if (changeResult.changed) {
        // Auto-supersede the prior document
        await supersedeDocument(sr, latestDoc.id, "", `Config changed: ${changeResult.fields.join(", ")}`, actor);

        // Reopen findings that depended on published terms
        const reopened = await reopenTermsFindings(sr, cid, actor);

        // If the prior document was published, STOP — legal review required
        if (latestDoc.status === "published") {
          errors.push({
            stop: "config_changed",
            detail: `Challenge configuration changed after generation (${changeResult.fields.join(", ")}). ` +
                    `Prior published TermsDocument superseded. ${reopened} finding(s) reopened. ` +
                    `Legal review required before re-assembly.`,
          });
          await logAudit(sr, {
            event_type: "assessment_run",
            challenge_id: cid,
            actor_id: actor?.id || "",
            actor_email: actor?.email || "",
            detail: `Terms assembly STOPPED — config changed (${changeResult.fields.join(", ")}). Published doc ${latestDoc.id} superseded.`,
          });
          return { errors, warnings };
        }
        // If prior was draft/reviewed, just superseded it — proceed with new assembly
        warnings.push(`Prior ${latestDoc.status} TermsDocument superseded due to config change (${changeResult.fields.join(", ")}).`);
      }
    }
  }

  // ── Select clauses (STOP 4: unsigned/expired skipped) ────────────────
  const { selected, skipErrors } = await selectClauses(sr, facts);
  errors.push(...skipErrors);

  // ── STOP 1: No approved clause covers a required category ───────────
  const requiredCategories = getRequiredCategories(facts, classification);
  const selectedCategories = new Set(selected.map((c) => c.category));
  const missingCategories = [...requiredCategories].filter((c) => !selectedCategories.has(c));
  if (missingCategories.length) {
    errors.push({
      stop: "missing_required_clause",
      detail: `No approved clause covers required category(ies): ${missingCategories.join(", ")}. Legal review required.`,
    });
  }

  // ── STOP 2: Prohibited combinations ─────────────────────────────────
  for (const c of selected) {
    for (const prohibitedId of c.prohibited_combinations || []) {
      if (selected.some((s) => s.identifier === prohibitedId)) {
        errors.push({
          stop: "prohibited_combination",
          detail: `Clause '${c.identifier}' is prohibited in combination with '${prohibitedId}'. Legal review required.`,
        });
      }
    }
  }

  // Check required combinations
  for (const c of selected) {
    for (const requiredId of c.required_combinations || []) {
      if (!selected.some((s) => s.identifier === requiredId)) {
        errors.push({
          stop: "missing_required_combination",
          detail: `Clause '${c.identifier}' requires clause '${requiredId}' which is not selected. Legal review required.`,
        });
      }
    }
  }

  // If STOP conditions hit, return errors
  if (errors.length) {
    await logAudit(sr, {
      event_type: "assessment_run",
      challenge_id: cid,
      actor_id: actor?.id || "",
      actor_email: actor?.email || "",
      detail: `Terms assembly FAILED — ${errors.length} STOP condition(s): ${errors.map((e) => e.detail).join("; ")}`,
    });
    return { errors, warnings };
  }

  // ── STOP 3: Resolve required variables ───────────────────────────────
  const vars = await resolveVariables(sr, cid, facts, {});

  for (const c of selected) {
    for (const varName of c.required_variables || []) {
      if (!vars[varName] || String(vars[varName]).trim() === "") {
        // Rule 1: chance classification halts if permit number is empty
        if (varName === "permit_numbers" && c.category === "permit_statements") {
          errors.push({
            stop: "unresolved_variable",
            detail: `Required variable '${varName}' is unresolved for clause '${c.identifier}'. ` +
                    `Permit number is required for ${classification} challenges.`,
          });
        } else {
          errors.push({
            stop: "unresolved_variable",
            detail: `Required variable '${varName}' is unresolved for clause '${c.identifier}'.`,
          });
        }
      }
    }
  }

  if (errors.length) {
    await logAudit(sr, {
      event_type: "assessment_run",
      challenge_id: cid,
      actor_id: actor?.id || "",
      actor_email: actor?.email || "",
      detail: `Terms assembly FAILED — unresolved variables: ${errors.map((e) => e.detail).join("; ")}`,
    });
    return { errors, warnings };
  }

  // ── Merge clauses with variables ─────────────────────────────────────
  const mergedOutput = selected.map((c) => {
    const body = mergeVariables(c.body, vars);
    return `### ${c.title}\n\n${body}`;
  }).join("\n\n---\n\n");

  // ── Create TermsDocument ──────────────────────────────────────────────
  const configSnapshot = buildConfigSnapshot(facts, classification);

  const doc = await sr.entities.TermsDocument.create({
    challenge_id: cid,
    clause_versions_used: selected.map((c) => c.id),
    merged_output: mergedOutput,
    status: "draft",
    config_snapshot: configSnapshot,
    change_note: "",
  });

  await logAudit(sr, {
    event_type: "assessment_run",
    challenge_id: cid,
    actor_id: actor?.id || "",
    actor_email: actor?.email || "",
    detail: `Terms document ${doc.id} assembled (draft). ${selected.length} clauses. Classification: ${classification}.`,
  });

  return {
    document: doc,
    clauses_used: selected.length,
    classification,
    clauses: selected.map((c) => ({ id: c.id, identifier: c.identifier, title: c.title, category: c.category })),
    errors: [],
    warnings,
  };
}