// Participant Rights & Marketing Consent Helper (Prompt 21)
//
// Platform-wide rights model — what participants grant, how it's captured,
// and how 53 and hosts may use entries in marketing. Licence-based;
// participants keep ownership.
//
// THE ONE RULE (verbatim):
//   An entry's EFFECTIVE marketing scopes =
//     scopes the participant granted
//     ∩ scopes the challenge configuration allows
//     − scopes blocked by an open MusicDeclaration or MediaRelease gap
//   All use checks evaluate effective scopes, never raw grants.
//
// KEY INVARIANTS:
//  - Rule 1: Declining every Tier 2/3 scope still allows entry, competing,
//    and winning. marketing_contact is never pre-ticked, never required.
//  - Rule 2: A dance entry declaring commercial music passes display/judging
//    but fails social_repost at the use gate until clearance is recorded.
//  - Rule 3: Every cleared use, including host uses, produces a
//    MarketingUseLog record.
//  - Rule 4: Revoking platform_promotion blocks future checks and creates
//    takedown tasks for logged owned-channel uses without affecting Tier 1
//    display. Tier 1 non-revocable for the challenge period.
//  - Rule 5: A minor's Tier 2/3 scopes stay inactive until the guardian
//    countersign includes matching scopes.

// ── Tier constants ──────────────────────────────────────────────────────
export const TIERS = {
  TIER1: "tier1_mandatory",
  TIER2: "tier2_standard",
  TIER3: "tier3_extended",
  MARKETING_CONTACT: "marketing_contact",
} as const;

// Tier 1 scopes — mandatory, condition of entry, non-revocable for challenge period
export const TIER1_SCOPES = [
  "display_platform",
  "judging_use",
  "winner_announcement",
  "archival",
] as const;

// Tier 2 scopes — standard, default-on, individually declinable
export const TIER2_SCOPES = [
  "platform_promotion",
  "challenge_recap",
  "social_repost",
] as const;

// Tier 3 scopes — extended, opt-in, unticked
export const TIER3_SCOPES = [
  "sponsor_host_use",
  "attribution",
  "non_sublicensable",
  "testimonial_nil",
  "derivative_compilation",
  "future_campaigns",
] as const;

// Marketing contact — always separate, never pre-ticked, never required
export const MARKETING_CONTACT_SCOPE = "marketing_contact" as const;

// ── Rights scope → Guardian consent scope mapping ──────────────────────
// Minor's Tier 2/3 scopes require the matching guardian scope.
// Maps rights scope_code → GuardianConsent boolean field name.
export const RIGHTS_TO_GUARDIAN_SCOPE: Record<string, string> = {
  display_platform: "scopes_publication_of_entry_media",
  judging_use: "scopes_entering_challenge",
  winner_announcement: "scopes_publication_of_entry_media",
  archival: "scopes_publication_of_entry_media",
  platform_promotion: "scopes_promotional_reuse",
  challenge_recap: "scopes_publication_of_entry_media",
  social_repost: "scopes_promotional_reuse",
  sponsor_host_use: "scopes_promotional_reuse",
  attribution: "scopes_public_display_name",
  non_sublicensable: "scopes_promotional_reuse",
  testimonial_nil: "scopes_direct_communication_with_minor",
  derivative_compilation: "scopes_promotional_reuse",
  future_campaigns: "scopes_promotional_reuse",
  marketing_contact: "scopes_direct_communication_with_minor",
};

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

// ── Check if a template is signed ───────────────────────────────────────
export function isTemplateSigned(template): boolean {
  const ls = template?.legal_signoff;
  if (!ls || typeof ls !== "object") return false;
  return !!(
    ls.reviewer && ls.date && ls.reference &&
    String(ls.reviewer).trim() && String(ls.date).trim() && String(ls.reference).trim()
  );
}

// ── Check if a template is expired ──────────────────────────────────────
export function isTemplateExpired(template): boolean {
  if (!template?.retirement_date) return false;
  try {
    return new Date(template.retirement_date) <= new Date();
  } catch {
    return false;
  }
}

// ── Get active (signed, current, non-expired) templates ─────────────────
export async function getActiveTemplates(sr) {
  const all = await sr.entities.RightsGrantTemplate.filter(
    { is_current: true }, "sort_order", 500
  ).catch(() => []);
  return (all || []).filter((t) => isTemplateSigned(t) && !isTemplateExpired(t));
}

// ── Get the ChallengeRightsConfiguration for a challenge ───────────────
export async function getRightsConfig(sr, challenge_id) {
  const cid = String(challenge_id);
  const configs = await sr.entities.ChallengeRightsConfiguration.filter(
    { challenge_id: cid }, "-created_date", 1
  ).catch(() => []);
  return configs?.[0] || null;
}

// ── Get the ParticipantRightsRecord for an entry ───────────────────────
export async function getRightsRecordForEntry(sr, entry_id) {
  const eid = String(entry_id);
  const records = await sr.entities.ParticipantRightsRecord.filter(
    { entry_id: eid }, "-created_date", 1
  ).catch(() => []);
  return records?.[0] || null;
}

// ── Get MusicDeclarations for an entry ──────────────────────────────────
export async function getMusicDeclarationsForEntry(sr, entry_id) {
  const eid = String(entry_id);
  return await sr.entities.MusicDeclaration.filter(
    { entry_id: eid }, "-created_date", 50
  ).catch(() => []);
}

// ── Get MediaReleases for an entry ──────────────────────────────────────
export async function getMediaReleasesForEntry(sr, entry_id) {
  const eid = String(entry_id);
  return await sr.entities.MediaRelease.filter(
    { entry_id: eid }, "-created_date", 50
  ).catch(() => []);
}

// ── Get the guardian consent for an entry (if minor) ────────────────────
export async function getGuardianConsentForRights(sr, entry) {
  if (!entry || !entry.is_minor) return null;
  const records = await sr.entities.GuardianConsent.filter(
    { challenge_id: String(entry.challenge_id), entry_id: String(entry.id) },
    "-created_date", 1
  ).catch(() => []);
  return records?.[0] || null;
}

// ── THE CORE: Compute effective marketing scopes ───────────────────────
// effective = granted ∩ configured − blocked
// Returns { effective: string[], granted: string[], configured: string[], blocked: string[], block_reasons: object }
export function computeEffectiveScopes(
  rightsRecord,
  rightsConfig,
  musicDeclarations,
  mediaReleases,
  guardianConsent
) {
  // 1. Granted scopes from the participant's rights record
  const grantedSet = new Set<string>();
  if (rightsRecord?.scope_grants) {
    for (const g of rightsRecord.scope_grants) {
      if (g.status === "granted") {
        grantedSet.add(g.scope_code);
      }
    }
  }

  // 2. Configured (allowed) scopes from the challenge config
  const configuredSet = new Set<string>();
  if (rightsConfig?.included_scope_versions) {
    for (const s of rightsConfig.included_scope_versions) {
      configuredSet.add(s.scope_code);
    }
  }

  // 3. Blocked scopes from music/media gaps
  const blockedSet = new Set<string>();
  const blockReasons: Record<string, string> = {};

  // Music: commercial music blocks social_repost unless cleared
  for (const md of musicDeclarations || []) {
    if (md.basis === "commercial" && md.clearance_status !== "cleared") {
      blockedSet.add("social_repost");
      blockReasons["social_repost"] = `Commercial music declaration not cleared (status: ${md.clearance_status}).`;
    }
  }

  // Media: open/pending media releases block publication/promotion scopes
  for (const mr of mediaReleases || []) {
    if (mr.status !== "granted") {
      for (const scope of ["platform_promotion", "social_repost", "sponsor_host_use", "derivative_compilation"]) {
        blockedSet.add(scope);
        blockReasons[scope] = `Pending media release for ${mr.subject_name}.`;
      }
    }
  }

  // 4. Minor scope gating: Tier 2/3 scopes require matching guardian scope
  if (rightsRecord?.is_minor && guardianConsent) {
    for (const g of rightsRecord?.scope_grants || []) {
      if (g.status !== "granted") continue;
      const tier = g.tier || "";
      if (tier !== TIERS.TIER2 && tier !== TIERS.TIER3 && tier !== TIERS.MARKETING_CONTACT) continue;

      const guardianScopeField = RIGHTS_TO_GUARDIAN_SCOPE[g.scope_code];
      if (guardianScopeField && !guardianConsent[guardianScopeField]) {
        // Guardian hasn't countersigned this scope → not effective
        grantedSet.delete(g.scope_code);
      }
    }
  } else if (rightsRecord?.is_minor && !guardianConsent) {
    // Minor with no guardian consent → all Tier 2/3 scopes inactive
    for (const g of rightsRecord?.scope_grants || []) {
      const tier = g.tier || "";
      if (tier === TIERS.TIER2 || tier === TIERS.TIER3 || tier === TIERS.MARKETING_CONTACT) {
        grantedSet.delete(g.scope_code);
      }
    }
  }

  // 5. Effective = granted ∩ configured − blocked
  const effective = [...grantedSet].filter(
    (s) => configuredSet.has(s) && !blockedSet.has(s)
  );

  return {
    effective,
    granted: [...grantedSet],
    configured: [...configuredSet],
    blocked: [...blockedSet],
    block_reasons: blockReasons,
  };
}

// ── Check if a specific use is cleared ──────────────────────────────────
// Returns { cleared: boolean, effective_scopes, missing: string[], blocked: string[] }
export async function checkUseCleared(
  sr,
  entry_id,
  requestedScopes,
  actor
) {
  const eid = String(entry_id);

  // Fetch the entry
  const entries = await sr.entities.Entry.filter(
    { id: eid }, "-created_date", 1
  ).catch(() => []);
  const entry = entries?.[0];
  if (!entry) {
    return { cleared: false, missing: ["entry_not_found"], blocked: [], effective_scopes: [] };
  }

  // Fetch all dependencies
  const [rightsRecord, rightsConfig, musicDecls, mediaReleases, guardianConsent] = await Promise.all([
    getRightsRecordForEntry(sr, eid),
    getRightsConfig(sr, entry.challenge_id),
    getMusicDeclarationsForEntry(sr, eid),
    getMediaReleasesForEntry(sr, eid),
    null, // placeholder — fetch below
  ]);

  const gc = entry.is_minor ? await getGuardianConsentForRights(sr, entry) : null;

  const { effective } = computeEffectiveScopes(
    rightsRecord, rightsConfig, musicDecls, mediaReleases, gc
  );

  const effectiveSet = new Set(effective);
  const missing = [];
  const blocked = [];

  for (const scope of requestedScopes || []) {
    if (!effectiveSet.has(scope)) {
      // Check why it's missing
      if (rightsRecord?.scope_grants?.some((g) => g.scope_code === scope && g.status === "granted")) {
        // Granted but blocked by music/media or not configured
        blocked.push(scope);
      } else {
        missing.push(scope);
      }
    }
  }

  const cleared = missing.length === 0 && blocked.length === 0;

  // Rule 3: Every cleared use produces a MarketingUseLog record — caller handles that.
  return { cleared, effective_scopes: effective, missing, blocked };
}

// ── Revoke a scope (prospective for Tier 2/3) ───────────────────────────
// Rule 4: Revoking platform_promotion blocks future checks and creates
// takedown tasks for logged owned-channel uses. Tier 1 non-revocable.
export async function revokeScope(sr, entry_id, scope_code, actor) {
  const eid = String(entry_id);

  // Tier 1 is non-revocable for the challenge period
  if (TIER1_SCOPES.includes(scope_code)) {
    return { revoked: false, error: "Tier 1 scopes are non-revocable for the challenge period." };
  }

  const record = await getRightsRecordForEntry(sr, eid);
  if (!record) {
    return { revoked: false, error: "Rights record not found." };
  }

  // Update the scope grant to declined
  const updatedGrants = (record.scope_grants || []).map((g) => {
    if (g.scope_code === scope_code) {
      return { ...g, status: "declined" };
    }
    return g;
  });

  // Update record status
  const hasActiveGrants = updatedGrants.some((g) => g.status === "granted" && (g.tier === TIERS.TIER2 || g.tier === TIERS.TIER3));
  const newStatus = hasActiveGrants ? "partially_revoked" : "revoked";

  await sr.entities.ParticipantRightsRecord.update(record.id, {
    scope_grants: updatedGrants,
    status: newStatus,
    revoked_at: newStatus === "revoked" ? new Date().toISOString() : record.revoked_at,
  });

  // Create takedown tasks for logged owned-channel uses relying on this scope
  const useLogs = await sr.entities.MarketingUseLog.filter(
    { entry_id: eid, takedown_status: "not_required" }, "-used_at", 100
  ).catch(() => []);

  let takedownsCreated = 0;
  for (const log of useLogs || []) {
    if (log.scopes_relied_on?.includes(scope_code)) {
      await sr.entities.MarketingUseLog.update(log.id, {
        takedown_status: "pending",
        notes: (log.notes || "") + ` | Takedown required: scope '${scope_code}' revoked.`,
      });
      takedownsCreated++;
    }
  }

  await logAuditInline(sr, {
    event_type: "finding_updated",
    challenge_id: record.challenge_id || "",
    actor_id: actor?.id || "",
    actor_email: actor?.email || "",
    detail: `Scope '${scope_code}' revoked for entry ${eid}. Status: ${newStatus}. Takedown tasks: ${takedownsCreated}.`,
  });

  return { revoked: true, status: newStatus, takedowns_created: takedownsCreated };
}

// ── Build plain-language rights summary for entry flow ─────────────────
// Returns a structured summary grouped by tier for display to participants.
export async function buildRightsSummary(sr, challenge_id) {
  const cid = String(challenge_id);
  const config = await getRightsConfig(sr, cid);
  if (!config) return null;

  const templates = await getActiveTemplates(sr);
  const includedScopes = (config.included_scope_versions || []).map((s) => s.scope_code);
  const includedTemplates = templates.filter((t) => includedScopes.includes(t.scope_code));

  const grouped = {
    tier1: [],
    tier2: [],
    tier3: [],
    marketing_contact: [],
  };

  for (const t of includedTemplates) {
    const entry = {
      scope_code: t.scope_code,
      display_name: t.display_name,
      description: t.description || "",
      clause_reference: t.clause_reference,
      template_id: t.id,
    };
    if (t.tier === TIERS.TIER1) grouped.tier1.push(entry);
    else if (t.tier === TIERS.TIER2) grouped.tier2.push(entry);
    else if (t.tier === TIERS.TIER3) grouped.tier3.push(entry);
    else if (t.tier === TIERS.MARKETING_CONTACT) grouped.marketing_contact.push(entry);
  }

  return {
    config,
    tiers: grouped,
    music_policy: config.music_policy,
    third_party_policy: config.third_party_policy,
    sponsor_use_period: config.sponsor_use_period,
  };
}

// ── Assemble facts for compliance triggers ──────────────────────────────
// Called by complianceAssessmentEngine.assembleFacts to add rights facts.
export async function assembleRightsFacts(sr, challenge_id) {
  const cid = String(challenge_id);
  const facts = {};

  const config = await getRightsConfig(sr, cid);
  if (!config) return facts;

  facts.rights_music_policy = config.music_policy || "original_or_licensed_only";
  facts.rights_third_party_policy = config.third_party_policy || "none_permitted";

  // Check if any marketing scopes (Tier 2/3) are included
  const includedScopes = (config.included_scope_versions || []).map((s) => s.scope_code);
  const hasMarketingScopes = includedScopes.some((s) =>
    [...TIER2_SCOPES, ...TIER3_SCOPES].includes(s)
  );
  facts.rights_has_marketing_scopes = hasMarketingScopes;

  facts.rights_commercial_music_permitted = config.music_policy === "commercial_music_display_only";
  facts.rights_third_parties_expected = config.third_party_policy !== "none_permitted";
  facts.rights_ugc_marketing_use = hasMarketingScopes;

  return facts;
}