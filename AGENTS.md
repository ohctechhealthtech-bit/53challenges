# AGENTS.md

## Project Context

This is a Base44 app repository. Treat it as user-owned application code, keep changes focused on the user's request, and preserve existing project conventions.

Start with `README.md` for local setup, environment variables, and publish workflow.

## Base44 References

- CLI overview: https://docs.base44.com/developers/references/cli/get-started/overview.md
- Agent skills: https://docs.base44.com/developers/backend/overview/skills.md

If your agent supports Agent Skills, install or update Base44 skills before Base44-specific work:

```bash
npx skills add base44/skills
```

## Key Files

- `src/`: frontend application source.
- `src/api/base44Client.js`: frontend Base44 SDK client.
- `vite.config.js`: Vite config and Base44 Vite plugin setup.
- `.env.local`: local-only environment values; never commit secrets.

## Working Notes

- Use `base44 dev` as the default local development command when you need the local Base44 backend. It can run the backend and frontend together.
- When docs or code mention the frontend being started automatically, that usually means the Base44 project config includes `site.serveCommand`, for example `"serveCommand": "npm run dev"` in `base44/config.jsonc`.
- Use `npm run dev` only for frontend-only work against the hosted Base44 backend.
- Prefer the existing Base44 CLI workflow over adding new npm scripts for Base44-specific tasks.
- Reuse the existing SDK client and Vite plugin patterns before adding new Base44 integration paths.
- Run the relevant checks from `package.json` before finishing code changes.

## Canonical Taxonomy

The **six parent Categories** are defined once in `src/lib/challenges-data.js` as the
`CATEGORIES` constant — the single source of truth for category across the homepage,
`/challenges` filter pills, category landing pages and the `ChallengeCategory` catalog
entity. Do not branch category logic elsewhere, and do not add, rename, remove, or
import external category taxonomies (no ChallengeForge categories). The local
`Challenge` entity's `category` enum is a legacy discipline field and is NOT the
canonical category list.

## Domain Entities

### Compliance Gate (Prompt 13)

Interim administrative gating layer that prevents a challenge from accepting entries
or votes until legal/compliance sign-off is complete. A challenge is "launch blocked"
while its gate has `launch_blocked = true`.

- **`ComplianceGate`** (`base44/entities/ComplianceGate.jsonc`) — per-challenge gate.
  - `challenge_id` (required), `challenge_title`
  - Review checklist booleans: `promoter_confirmed`, `terms_approved`,
    `minor_participation_reviewed`, `permit_position_recorded`,
    `prize_funding_confirmed`
    (the old `voting_reviewed` boolean was removed in Prompt 15 — voting
    compliance now derives from `VotingConfiguration` presence)
  - `legal_review_status`: `not_started` | `in_progress` | `cleared` | `blocked`
  - `legal_review_reference`, `gate_notes`
  - `launch_blocked` (boolean, default `true`) — the authoritative block flag
  - `grandfathered_live` (boolean, default `false`) — **rationale:** challenges that
    were already live (accepting entries/votes) before the gate existed are marked
    grandfathered so the gate does not retroactively block an in-flight competition.
    Grandfathered challenges bypass the launch-block enforcement while still being
    tracked in the audit log, so existing public flows keep working without a
    surprise freeze.
- **`ComplianceGateLog`** (`base44/entities/ComplianceGateLog.jsonc`) — append-only
  audit trail. One row per gate lifecycle event: `gate_created`, `field_change`,
  `launch_unblocked`, `launch_blocked`, `enforcement_block`, `grandfathered`,
  `synced`. Captures `gate_id`, `challenge_id`, `field_name`, `old_value`,
  `new_value`, `changed_by_id`, `changed_by_email`, `note`.

Enforcement: the `challengeApi` backend function refuses to forward `submit_entry`
and `cast_vote` for any challenge whose gate has `launch_blocked = true` (returns
403 and writes an `enforcement_block` log). Challenges are annotated with
`compliance_blocked` on the client via `challengeApi.complianceStatuses`, so the UI
hides Enter/Vote buttons and shows a paused notice. See
`base44/shared/complianceGateHelper.ts` and `base44/functions/complianceGate/entry.ts`.

### Taxonomy Hygiene & Discovery Tags (Prompt 14)

The `Category` and `Subcategory` catalog entities carry the fields pickers need to
hide deactivated items and control display order, without importing any external
taxonomy:

- **`Category`** / **`Subcategory`** each gained:
  - `is_active` (boolean, default `true`) — `false` removes the record from
    new-challenge pickers. Existing challenges that already reference a
    deactivated subcategory still render correctly because they store the
    slug/name as a plain string, not a foreign key that breaks.
  - `sort_order` (number, default `0`) — admin-controlled display order.
  - `slug` (URL-safe string) — already present; maintained unique and URL-safe.

- **`Challenge`** gained `niche_tags` (array of strings, default `[]`) — free-text
  discovery/feed-targeting tags. These affect **search/discovery/feed targeting
  ONLY**. They have no effect on structure, rules, judging, or compliance. No
  `account_type`, no second mechanic list, no free-text subcategory replacement.

Shared helpers live in `src/lib/taxonomy.js`:
- `isTaxonomyActive(rec)` / `activeTaxonomy(list)` — the single pickability check.
- `orderedTaxonomy(list)` — active records sorted by `sort_order` then name.
- `slugify(value)` — URL-safe slug generator for seeding slugs.
- `matchChallengeSearch(ch, query)` — free-text match over title/theme/brief/
  description/category **and** `niche_tags`; used by the `/challenges` discovery
  search so `niche_tags` filters search results and nothing else.

## Domain Entities (Prompt 15)

### PromoterAppointment

The legal promoter of a challenge is an **explicit appointment**, never an
assumption. The challenge owner, sponsor, or host is NEVER automatically the
promoter — this record is the only source of truth. One per challenge, required
before the challenge can pass the compliance gate / publish.

- **`PromoterAppointment`** (`base44/entities/PromoterAppointment.jsonc`)
  - `challenge_id` (required), `promoter_type` (required): `platform53` |
    `host_organisation` | `joint`
  - `promoter_entity_name` (required), `abn`, `contact`
  - `appointed_by` (staff user), `appointed_at`
  - `basis_document` (file ref: contract/agreement, required when host or joint)
  - `notes`
- **Rule 3:** `evaluateClearance()` in `complianceGateHelper.ts` refuses to
  clear `launch_blocked` unless a `PromoterAppointment` exists for the
  challenge.

### VotingConfiguration

Voting is a full configuration record, never a yes/no flag. Absence of a
`VotingConfiguration` for a challenge = no voting configured for that challenge.

- **`VotingConfiguration`** (`base44/entities/VotingConfiguration.jsonc`)
  - `challenge_id` (required), `voting_purpose` (required): `determines_winner`
    | `weighted_component` | `finalist_selection` | `audience_award_only` |
    `engagement_only`
  - `weight_in_final_result` (percentage; 0 for audience_award_only /
    engagement_only)
  - `paid_voting`, `bonus_or_referral_votes` (booleans)
  - `votes_per_person_per_account` / `_per_device` / `_per_period` (integers)
  - `identity_verification`: `none` | `email` | `account` | `stronger`
  - `geographic_restrictions` (multi-enum: states)
  - `anti_bot_controls` (multi-enum: `rate_limit`, `captcha`,
    `device_fingerprint`, `manual_review`)
  - `live_totals_public`, `vote_audit_procedure`, `tie_break_rule`
  - `moderator_adjustment_authority`, `judges_can_override`
  - `legal_opinion_reference` (nullable until advice received)
- **Rule 1:** The old standalone `voting_reviewed` boolean on `ComplianceGate`
  has been **removed**. Voting compliance now derives from
  `VotingConfiguration` presence. Existing `voting_reviewed=true` data was
  migrated into `VotingConfiguration` records.
- **Rule 2:** `evaluateClearance()` keeps a challenge `launch_blocked` when a
  `VotingConfiguration` exists with `voting_purpose` = `determines_winner` or
  `weighted_component` AND `legal_opinion_reference` is empty — regardless of
  other checks.
- **Rule 5:** No standalone voting boolean remains in the codebase
  (`voting_reviewed` removed from schema, helper, function, client, editor, and
  admin page).

## Domain Entities (Prompt 17)

### Lifecycle Gates

Replaces the single-approval model (interim Prompt 13 gate) with stage gates.
The interim gate (Prompt 13) remains in force until lifecycle gate checks pass
for a challenge, then its logic is superseded — fields remain visible,
read-only for history.

- **`LifecycleGate`** (`base44/entities/LifecycleGate.jsonc`) — reference data
  defining the seven stage gates in order:
  - `code` (required): `publish` | `open_entry` | `accept_minors` |
    `open_voting` | `close_and_judge` | `publish_results` | `release_prize`
  - `name` (required), `description`, `sort_order`, `is_active`
- **`GateCheck`** (`base44/entities/GateCheck.jsonc`) — per challenge per gate.
  - `challenge_id` (required), `gate_code` (required)
  - `status`: `pending` | `passed` | `blocked` (default `pending`)
  - `passed_at`, `passed_by_id`, `passed_by_email`
  - `relocked_reason` — set when a gate is re-locked due to reopened findings
  - `notes`

**Gate blocking requirements:**
- `publish`: PromoterAppointment exists; assessment run with no open blocking
  findings for this stage; draft terms approved.
- `open_entry`: Final terms published (Prompt 19); permit-type findings
  satisfied; privacy/consent flows active.
- `accept_minors`: Guardian consent workflow active (Prompt 20).
- `open_voting`: VotingConfiguration complete; voting controls confirmed;
  voting rules published in terms.
- `close_and_judge`: Entry snapshot locked; judge conflict declarations recorded.
- `publish_results`: Results sign-off; results-hold workflow complete; open
  disputes reviewed.
- `release_prize`: Winner verified; guardian verified where winner is a minor;
  two-person release complete.

**Rules:**
1. Each finding/obligation maps to the earliest gate where it must be satisfied
   — the `gate` field on `RegulatoryRuleVersion` (default `publish`) flows into
   `ComplianceAssessmentFinding` when created. Gates check evidence-linked
   findings, never checkboxes.
2. Passing a gate is audit-logged with actor; gates re-lock if underlying
   findings reopen.
3. A challenge with an open blocking permit finding mapped to `open_entry` can
   pass `publish` but cannot pass `open_entry`.
4. Reopening a finding after a prize-pool change re-locks the affected gate
   even if previously passed.
5. The interim `launch_blocked` logic no longer governs; fields remain visible,
   read-only. Enforcement (`isEntryBlocked`, `isVoteBlocked`, `isPublishBlocked`
   in `lifecycleGateHelper.ts`) uses lifecycle gates when `GateCheck` records
   exist, falling back to the interim gate for challenges not yet in the
   lifecycle system.

**Schema changes to existing entities (Prompt 17):**
- `RegulatoryRuleVersion` gained `gate` (enum, default `publish`).
- `ComplianceAssessmentFinding` gained `gate` (enum, default `publish`).
- `ComplianceAuditEvent` gained `gate_passed` and `gate_relocked` event types.

**Shared helper:** `base44/shared/lifecycleGateHelper.ts`
- `evaluateGate(sr, challenge_id, gate_code)` — checks blocking findings +
  structural requirements.
- `passGate(sr, challenge_id, gate_code, actor)` — creates/updates GateCheck,
  audit-logs.
- `relockGatesWithOpenFindings(sr, challenge_id, actor)` — re-locks passed
  gates that have open blocking findings (called after every assessment).
- `isEntryBlocked` / `isVoteBlocked` / `isPublishBlocked` — enforcement
  functions used by `submitChallengeEntry`, `castVote`, and `challengeApi`.

**Backend function:** `base44/functions/lifecycleGate/entry.ts`
- `list_gates`, `gate_status`, `check_gate`, `pass_gate`.

**Engine update:** `runAssessment` in `complianceAssessmentEngine.ts` now sets
`gate` on each finding from the rule version's `gate` field.
`runComplianceAssessment/entry.ts` calls `relockGatesWithOpenFindings` after
every assessment run.

## Domain Entities (Prompt 18)

### Trade Promotion Permit Tracker

Lifecycle management for permits/authorities/notifications, feeding evidence
into compliance findings. Validity is checked at EVERY gate evaluation, not
just at linking time.

- **`PermitOrAuthority`** (`base44/entities/PermitOrAuthority.jsonc`)
  - `jurisdiction_code` (required): NSW | VIC | QLD | WA | SA | TAS | ACT |
    NT | NATIONAL
  - `instrument_type` (required): `authority_multiyear` |
    `permit_single_promotion` | `licence`
  - `holder` (required): `platform53` | `host_organisation`
  - `holder_entity_name`, `reference_number` (required)
  - `issued_date`, `effective_date`, `expiry_date` (date strings)
  - `status`: `applied` | `issued` | `active` | `expiring_soon` | `expired` |
    `refused` | `surrendered` (default `applied`)
  - `covered_challenges` (array of challenge IDs; empty = covers all)
  - `fee` (number), `documents` (array of file URLs), `notes`

- **`PermitAction`** (`base44/entities/PermitAction.jsonc`)
  - `instrument_id`, `challenge_id` (strings)
  - `action_type` (required): `apply` | `notify_regulator` | `renew` |
    `lodge_winner_records` | `publish_results_record` | `amend`
  - `due_date` (date string), `status`: `pending` | `done` | `overdue`
  - `assigned_to`, `evidence` (file ref), `completed_at`, `notes`

**Schema change to existing entity (Prompt 18):**
- `ComplianceAssessmentFinding` gained `jurisdiction_code` (string, default "")
  — set from the rule's `jurisdiction_code` when the finding is created.

**Behaviour:**
1. A `permit_required` finding is satisfied by linking a valid
   `PermitOrAuthority` as `ObligationEvidence` (evidence_type =
   `permit_record`). Validity/status/dates/jurisdiction coverage is checked at
   EVERY gate evaluation via `recheckPermitFindings`, not just at linking.
2. **NSW pattern:** a platform-held multi-year authority may cover multiple
   challenges; each covered challenge auto-creates a `notify_regulator` action
   due 10 business days before entry opens. The `open_entry` gate blocks until
   done-with-evidence.
3. **NT cross-recognition:** an NT finding auto-satisfies when a valid permit
   for the same challenge exists in another jurisdiction.
4. `expiring_soon` at configurable lead (default 60 days); overdue actions
   escalate and re-lock affected gates.
5. Record cost per permit (`fee` field).

**Rules:**
1. Linking an expired instrument does not satisfy a finding.
2. NSW notification action's due date = entry-open date minus 10 business days.
3. Expiring an instrument re-locks gates on its covered challenges.

**Shared helper:** `base44/shared/permitHelper.ts`
- `isValidPermit`, `recheckPermitFindings`, `createNotificationActions`,
  `tryCrossRecognitionNT`, `checkExpiringInstruments`,
  `computeBusinessDaysBefore`.

**Backend function:** `base44/functions/permitTracker/entry.ts`
- `list_permits`, `create_permit`, `update_permit`, `list_actions`,
  `create_action`, `complete_action`, `link_permit_to_finding`,
  `expire_check`, `check_nt_cross_recognition`.

**Integration:**
- `lifecycleGate/entry.ts` calls `recheckPermitFindings` before every gate
  evaluation.
- `lifecycleGateHelper.ts` `evaluateGate` for `open_entry` checks for
  pending/overdue `notify_regulator` actions.
- `runComplianceAssessment/entry.ts` calls `tryCrossRecognitionNT` and
  `createNotificationActions` after every assessment.
- `complianceAssessmentEngine.ts` sets `jurisdiction_code` on findings.

## Domain Entities (Prompt 19)

### Approved Clause Library & Terms Assembler

Assembles lawyer-approved clauses into immutable TermsDocument entities for
specific challenges, with strict STOP conditions for missing configurations
or unsigned content.

- **`ApprovedClause`** (`base44/entities/ApprovedClause.jsonc`) — clause library.
  - `identifier` (required), `title` (required), `body` (required),
    `category` (required)
  - Categories: `promoter_identity`, `eligibility`, `entry_method`,
    `free_entry_route`, `judging`, `voting`, `draw_procedure`, `prizes`,
    `permit_statements`, `privacy`, `rights_grants`, `minors`, `disputes`,
    `liability`, `general`
  - `applicable_jurisdictions` (array), `inclusion_rule` (object),
    `required_combinations`, `prohibited_combinations` (arrays)
  - `mandatory` (bool), `required_variables` (array)
  - `legal_signoff` (object: reviewer, date, reference) — unsigned = draft
  - `effective_from`, `retirement_date`, `version`, `is_current`

- **`TermsDocument`** (`base44/entities/TermsDocument.jsonc`) — assembled output.
  - `challenge_id` (required), `clause_versions_used` (array)
  - `merged_output` (string), `config_snapshot` (object)
  - `status`: `draft` | `reviewed` | `published` | `superseded`
  - `published_at`, `superseded_by`, `change_note`

**STOP conditions:**
1. No approved clause covers a required category.
2. Prohibited clause combination detected.
3. Unresolved template variable.
4. Unsigned or expired mandatory clause.
5. Config changed after generation (supersedes prior published doc).

**Rules:**
1. Chance classification requires permit numbers.
2. Unsigned clauses are never selected into output.
3. Prize pool change after publication auto-supersedes + reopens.
4. Published documents are immutable.
5. Draft terms satisfy publish gate; published terms satisfy open_entry gate.

**Shared helper:** `base44/shared/termsAssembler.ts`
**Backend function:** `base44/functions/termsAssembler/entry.ts`

**Integration:**
- `lifecycleGateHelper.ts` `evaluateGate` for `publish` requires a draft
  TermsDocument; `open_entry` requires a published TermsDocument.
- `submitChallengeEntry/entry.ts` records `terms_accepted_at` and
  `terms_document_id` on each entry.

## Domain Entities (Prompt 20)

### Guardian Consent (Granular)

Verifiable, scope-granular guardian consent for minor participants, plus
handling for minors appearing as subjects in entries.

- **`ConsentRequirement`** (`base44/entities/ConsentRequirement.jsonc`) — reference data.
  - `name` (required), `method` (required): `guardian_email_verification` |
    `guardian_account_countersign` | `school_bulk_consent`
  - `clause_reference` (string), `description` (string)
  - `is_active` (bool), `sort_order` (number)

- **`GuardianConsent`** (`base44/entities/GuardianConsent.jsonc`) — per minor per challenge.
  - `challenge_id` (required), `entry_id`, `participant_name` (required),
    `participant_email`
  - `requirement_id` (required), `requirement_version`
  - `guardian_name` (required), `guardian_relationship`, `guardian_contact`
  - `method_used`: same enum as ConsentRequirement
  - `status`: `pending` | `granted` | `declined` | `withdrawn` (default `pending`)
  - `verified_at`, `withdrawn_at`, `withdrawal_reason`
  - **Scopes** (each a separate boolean field):
    `scopes_entering_challenge`, `scopes_terms_acceptance`,
    `scopes_personal_info_processing`, `scopes_public_display_name`,
    `scopes_public_display_age_bracket`, `scopes_publication_of_entry_media`,
    `scopes_promotional_reuse`, `scopes_direct_communication_with_minor`,
    `scopes_public_voting_participation`, `scopes_prize_acceptance_payment`,
    `scopes_event_travel_attendance`, `scopes_appears_in_entry`
  - `consent_wording_hash` (string — versioned against exact wording)

**Schema change to existing entity (Prompt 20):**
- `Entry` gained `consent_status` (enum: `pending_consent` | `valid` |
  `withdrawn`, default `pending_consent`).

**Enforcement:**
1. A minor's entry saves as `pending_consent` and becomes valid only on
   `granted` with `entering_challenge`, `terms_acceptance`,
   `personal_info_processing` at minimum; pending entries expire at entry
   close (configurable grace).
2. Display surfaces check publication scopes; platform floor regardless of
   consent: first name + state only, never full name, age, or DOB publicly.
3. Judges never see age or identity; blind judging shows only an approved
   eligibility bracket.
4. Prize payment to a minor routes to the verified guardian through the
   existing two-person release.
5. Withdrawal removes public display, blocks future uses, and is audit-logged.
   Consent is versioned against exact wording and scopes.
6. `accept_minors` gate (Prompt 17) requires this workflow active and configured.

**Shared helper:** `base44/shared/guardianConsentHelper.ts`
- `MINIMUM_SCOPES`, `ALL_SCOPES`
- `hasMinimumConsent`, `isEntryVisibleToPublic`, `isEntryValidForJudging`
- `maskMinorName`, `getEligibilityBracket`, `shouldRoutePrizeToGuardian`
- `withdrawConsent`, `evaluateAcceptMinorsGate`, `getConsentForEntry`,
  `deriveEntryConsentStatus`

**Backend function:** `base44/functions/guardianConsent/entry.ts`
- `list_requirements`, `create_requirement`, `list_consents`, `get_consent`,
  `create_consent`, `grant_consent`, `decline_consent`, `withdraw_consent`,
  `check_entry_visibility`, `evaluate_minors_gate`.

**Integration:**
- `lifecycleGateHelper.ts` `evaluateGate` for `accept_minors` checks for active
  ConsentRequirement records.
- `submitChallengeEntry/entry.ts` sets `consent_status = "pending_consent"` on
  minor entries.

## Domain Entities (Prompt 21)

### Participant Rights & Marketing Consent Framework

Governs UGC usage rights, music licensing declarations, media releases, and
marketing consent through a granular scope-based system. Effective scopes are
calculated as an intersection of participant grants, challenge configuration,
and clearance status.

- **`RightsGrantTemplate`** (`base44/entities/RightsGrantTemplate.jsonc`) — clause
  library defining grantable scopes across four tiers:
  - `tier1_mandatory` — condition of entry, not declinable, not revocable:
    `display_platform`, `judging_use`, `winner_announcement`, `archival`
  - `tier2_standard` — default-on, individually declinable, revocable:
    `platform_promotion`, `challenge_recap`, `social_repost`
  - `tier3_extended` — opt-in, unticked, revocable:
    `sponsor_host_use`, `attribution`, `non_sublicensable`, `testimonial_nil`,
    `derivative_compilation`, `future_campaigns`
  - `marketing_contact` — always separate, never pre-ticked, never required,
    itemised per sender
  - Fields: `scope_code`, `tier`, `display_name`, `description`,
    `clause_reference`, `default_duration`, `default_territory`,
    `default_attribution`, `default_sublicensable`, `default_revocable`,
    `version`, `legal_signoff`, `is_current`, `effective_from`,
    `retirement_date`, `sort_order`

- **`ChallengeRightsConfiguration`** (`base44/entities/ChallengeRightsConfiguration.jsonc`)
  — per-challenge rights setup:
  - `challenge_id` (required), `included_scope_versions` (array of scope objects)
  - `music_policy`: `original_or_licensed_only` | `platform_supplied_tracks` |
    `commercial_music_display_only`
  - `third_party_policy`: `none_permitted` | `release_required` |
    `incidental_ok_for_display`
  - `sponsor_use_period` (string), `marketing_contact_senders` (array)

- **`ParticipantRightsRecord`** (`base44/entities/ParticipantRightsRecord.jsonc`)
  — per participant per challenge:
  - `challenge_id` (required), `entry_id`, `participant_name` (required),
    `participant_email`, `is_minor`, `guardian_consent_id`
  - `scope_grants` (array of objects), `marketing_contact_grants` (array)
  - `status`: `active` | `partially_revoked` | `revoked`
  - `accepted_at`, `revoked_at`, `config_snapshot`

- **`MusicDeclaration`** (`base44/entities/MusicDeclaration.jsonc`) — per entry:
  - `challenge_id` (required), `entry_id`, `basis` (required): `original` |
    `licensed` | `commercial` | `platform_track`
  - `track_title`, `track_artist`, `licence_evidence`
  - `clearance_status`: `not_required` | `pending` | `cleared` | `blocked`
  - `declared_at`, `cleared_at`, `notes`

- **`MediaRelease`** (`base44/entities/MediaRelease.jsonc`) — per subject:
  - `challenge_id` (required), `entry_id`, `subject_name` (required),
    `subject_type`: `adult` | `minor`
  - `guardian_consent_id`, `scopes_released` (array)
  - `method`: `written_consent` | `verbal_consent` | `guardian_countersign`
  - `release_file`, `status`: `pending` | `granted` | `declined` | `withdrawn`
  - `granted_at`, `withdrawn_at`, `notes`

- **`MarketingUseLog`** (`base44/entities/MarketingUseLog.jsonc`) — audit trail:
  - `challenge_id` (required), `entry_id`, `participant_name`
  - `used_by`: `platform` | `host`, `channel`, `description`, `url_or_file`
  - `scopes_relied_on` (array), `checked_by`, `used_at`
  - `takedown_status`: `not_required` | `pending` | `completed`
  - `takedown_at`, `notes`

**Schema changes to existing entities (Prompt 21):**
- `ComplianceTrigger` `detection_source` enum gained `rights_configuration`.
- `complianceAssessmentEngine.ts` `assembleFacts` now reads
  `ChallengeRightsConfiguration` and derives: `rights_music_policy`,
  `rights_third_party_policy`, `rights_has_marketing_scopes`,
  `rights_commercial_music_permitted`, `rights_third_parties_expected`,
  `rights_ugc_marketing_use`.
- `termsAssembler.ts` `resolveVariables` now pulls `rights_summary` from
  `ChallengeRightsConfiguration` for clause variable resolution.

**Behaviour:**
1. Effective marketing scopes = intersection of participant grants ∩ challenge
   config included scopes, minus blocked music/third-party/uncleared media.
2. Tier 1 scopes are always effective (mandatory, non-declinable).
3. Tier 2/3 scopes require participant grant AND challenge config inclusion.
4. Commercial music blocks scopes unless `music_policy` permits it AND
   `MusicDeclaration` is cleared.
5. Third-party subjects require a granted `MediaRelease` for their scopes.
6. Marketing contact grants are itemised per sender, never pre-ticked.
7. Revoking a Tier 2/3 scope sets `takedown_status = "pending"` on existing
   `MarketingUseLog` entries that relied on that scope, generating takedown tasks.

**Rules:**
1. The marketing-use gate checks effective scopes before any use is logged.
2. Tier 1 rights are non-revocable; withdrawal of challenge entry is the only
   path to remove them.
3. Minor participants' scope grants map to guardian consent fields — no scope
   is effective without the corresponding guardian consent scope being granted.
4. `rights_configuration` triggers fire when challenge config includes marketing
   scopes, commercial music, or third-party subjects.

**Shared helper:** `base44/shared/rightsHelper.ts`
- `TIERS`, `TIER1_SCOPES`, `TIER2_SCOPES`, `TIER3_SCOPES`
- `getActiveTemplates`, `getRightsConfig`, `getRightsRecordForEntry`
- `getMusicDeclarationsForEntry`, `getMediaReleasesForEntry`,
  `getGuardianConsentForRights`
- `computeEffectiveScopes` — the intersection engine
- `checkUseCleared` — marketing-use gate validation
- `revokeScope` — revokes a scope and generates takedown tasks
- `buildRightsSummary` — participant-facing disclosure summary
- `assembleRightsFacts` — feeds facts to the compliance assessment engine
- `isTemplateSigned`

**Backend function:** `base44/functions/rightsManager/entry.ts`
- `list_templates`, `sign_template`, `list_configs`
- `get_config`, `save_config`
- `get_rights_summary`, `capture_rights`, `get_rights_record`
- `create_music_declaration`, `clear_music_declaration`
- `create_media_release`, `grant_media_release`
- `check_use`, `log_use`, `list_use_logs`
- `revoke_scope`, `get_effective_scopes`

**Integration:**
- `complianceAssessmentEngine.ts` `assembleFacts` reads rights config for
  trigger evaluation (rights_configuration detection source).
- `termsAssembler.ts` `resolveVariables` includes `rights_summary` from
  rights config for clause variable resolution.
- `ComplianceRulesAdmin.jsx` includes a Rights tab backed by `RightsPanel`.

## Domain Entities (Prompt 22)

### Host Marketplace API (hostPortal)

Single connected flow: host registration → wizard (`/host-apply`) → proposal →
Stripe deposit (Supported / Fully managed packages) → admin review → live
challenge. All steps run through backend functions, never direct client writes.

- **`ChallengeDraft`** gained `challenge_id` (string, default "") — set when an
  admin approves the proposal and a native `Challenge` record is created from it.

**Backend function:** `base44/functions/hostPortal/entry.ts`

Host actions (any authenticated user, own records only):
- `submit_proposal` → `{ proposal }` — creates a `ChallengeDraft`
  (`origin: host_apply`, `review_status: intake_received`). Fields are
  whitelisted server-side; used by the wizard for self-service proposals AND by
  the post-payment return on `/my-challenge-proposals`.
- `list_my_proposals` — the caller's own `host_apply` drafts.
- `update_proposal` → `{ id, patch }` — allowed only while `review_status` is
  `intake_received` | `changes_requested` | `builder_started`; a host edit
  after `changes_requested` auto-resubmits (`submitted_for_review`).

Admin actions (`role=admin`):
- `admin_list` — all `host_apply` drafts (Corporate Services → Host Proposals tab).
- `approve` → `{ id }` — sets `review_status: approved` AND creates the native
  `Challenge` (`source: native`, `lifecycle_status: draft`), linking it via
  `ChallengeDraft.challenge_id`. From there the challenge flows through the
  existing compliance/lifecycle gates (`publish` → `open_entry` → …) to go live.
  Refuses (409) if a challenge was already created from the proposal.
- `request_changes` → `{ id, feedback }` (feedback required).
- `decline` → `{ id, reason }` (reason required).

**Payment:** `base44/functions/hostDepositCheckout/entry.ts` creates the Stripe
Checkout session (deposit derived server-side from `delivery_level`, never from
client input); success returns to `/my-challenge-proposals?paid=1&draft=…`,
which finalises the proposal through `hostPortal.submit_proposal`.

## Domain Entities (Prompt 23)

### Guardian Verification & Parental Consent (guardianPortal)

Guardian verification for minor entrants (ported from 53 Classes). A minor's
entry is gated behind an explicit guardian decision made through the API —
complementing the scope-granular `GuardianConsent` system (Prompt 20).

- **`Guardian`** (`base44/entities/Guardian.jsonc`)
  - `name` (required), `email` (required, unique key), `relationship`,
    `mobile`, `address`
  - `user_id`, `verified` — set when the guardian signs in and claims the record
  - `status`: `active` | `revoked`
- **`GuardianChild`** (`base44/entities/GuardianChild.jsonc`)
  - `guardian_id`, `guardian_email`, `child_name`, `child_email` (all required)
  - `status`: `active` | `revoked`, `linked_at`
- **`GuardianApprovalRequest`** (`base44/entities/GuardianApprovalRequest.jsonc`)
  - `guardian_id`, `guardian_email` (required), `guardian_name`
  - `child_name`, `child_email`, `entry_id`, `entry_title`, `challenge_id`,
    `challenge_title`, `division`
  - `status`: `pending` | `approved` | `declined` | `revoked`
  - `decline_reason`, `decided_at`, `notified_at`

**Schema changes to `Entry` (Prompt 23):**
- `guardian_approval_status`: `not_required` | `pending` | `approved` |
  `declined` | `revoked` (default `not_required`)
- `guardian_id`, `guardian_name`, `guardian_relationship`, `guardian_email`,
  `guardian_mobile`, `guardian_address`
- `approval_timestamp`, `decline_reason`

**Enforcement:**
1. `submitChallengeEntry` requires guardian name, relationship, email, mobile
   AND address for entrants under 18 (guardian email must differ from the
   entrant's); the entry saves with `guardian_approval_status: pending`,
   `consent_status: pending_consent`, and an open `GuardianApprovalRequest`.
   Upstream (Challenge-API) minor entries also record the guardian + request
   locally so the dashboard covers them.
2. `castVote` refuses votes on a minor's entry while
   `guardian_approval_status` is `pending` / `declined` / `revoked` (legacy
   entries without the field pass).
3. Guardian approval sets `guardian_approval_status: approved`,
   `approval_timestamp`, `consent_status: valid`; decline records
   `decline_reason` (mandatory); revoke sets `consent_status: withdrawn`.
   Every decision is audit-logged via `ComplianceAuditEvent`.

**Shared helper:** `base44/shared/guardianHelper.ts`
- `normEmail`, `upsertGuardian`, `linkChild`, `createApprovalRequest`,
  `applyGuardianDecision`

**Backend function:** `base44/functions/guardianPortal/entry.ts`
Identity is always the authenticated account email — a guardian only sees and
decides requests addressed to their own email.
- `register` → `{ name, relationship, mobile, address }` claim/update guardian record
- `me` — guardian record + linked children + pending count
- `link_child` → `{ child_name, child_email }` / `unlink_child` → `{ child_id }`
- `list_requests` — all approval requests for this guardian
- `activity` — linked children's entries (trimmed fields)
- `approve` → `{ request_id }`
- `decline` → `{ request_id, reason }` (reason required)
- `revoke` → `{ request_id, reason }` — withdraw a previously granted approval

**Backend function:** `base44/functions/guardianStatusNotify/entry.ts`
Best-effort notifications (never block the flow):
- `notify_request` → `{ request_id }` — emails the guardian a secure prompt to
  sign in and decide via `/guardian`
- `notify_decision` → `{ request_id }` — emails the entrant the outcome
- LIMITATION: platform email delivers to **registered app users only**; an
  unregistered guardian won't receive the email — the Guardian Dashboard
  (`/guardian`) is the reliable channel.

**Frontend:**
- `/guardian` — Parent/Guardian Dashboard (`src/pages/GuardianDashboard.jsx` +
  `src/components/guardian/*`): pending approvals, children's activity,
  decision history, guardian registration, child linking — all via
  `guardianPortal`.
- `SubmitEntry.jsx` collects mandatory guardian name, relationship, email,
  mobile and address for under-18 entrants and shows a "pending guardian
  approval" notice on success.