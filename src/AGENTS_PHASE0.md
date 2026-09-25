# Phase 0 — Schema Repair (COMPLETE, 8 Aug 2026)

Executed under Consolidated Master Document v2.1, Part IV. Schema repair only —
no new features, pages, or engine entities.

## Changes applied

1. **Subcategory → Category FK.** Added `category_id` (→ `Category.id`). All 26
   records backfilled, 0 unresolved. Corrections applied: Poetry / Short Story /
   Scriptwriting / Journalism (legacy text parent "Writing & Storytelling",
   which does not exist) → **Writing, Ideas & Innovation**; Photography and
   Digital Art → **Photography, Film & Digital**. The legacy `category` name-text
   field is retained and marked DEPRECATED in the schema — not deleted (retire in
   a later phase once consumers read `category_id`).

2. **ChallengeCategory → Category FK.** Added `category_id`, backfilled by slug.
   All 6 resolved. ChallengeCategory remains a **presentation layer only**, never
   a second taxonomy.

3. **Organisation merge (schema only; both entities had 0 records).**
   `Organisation.kind` enum widened to: platform, business, school,
   community_group, club, workplace, council, venue, sponsor, government,
   individual_host. Added `legal_name`, `abn`, `account_type_id`
   (→ `HostAccountType`), `billing_status`, `verification_status`,
   `internal_notes`. `signup_code` retained.
   **Field name decision:** kept as `kind` (widened) rather than renaming to
   `organisation_type` — the spec's intent is the concept, and the rename would
   break the existing org signup-code reads for zero data benefit.
   `HostOrganisation` marked **DEPRECATED** in its schema description; not
   deleted. `ChallengeDraft.host_organisation_id`,
   `IntakeResponse.host_organisation_id`, and
   `ChallengeRecommendation.host_organisation_id` now document
   **Organisation.id** as their target (0 records affected).

4. **Orphan cleanup (exported to JSON in chat before deletion).** Deleted 5
   `Vote`, 2 `VotingConfiguration`, 1 `PromoterAppointment` — all referenced
   challenge IDs absent from the Challenge entity. `ComplianceAuditEvent` (184),
   `ComplianceGateLog` (57), and `GateCheck` (61) untouched.

5. **RegulatoryRule.trigger_code backfill.** Wrote `chance_element` to
   `nsw_prize_notification`, `act_prize_3k`, `nt_prize_5k`. The 3 records that
   already carried values (`sa_draw_5k`, `sa_instant_win_any`,
   `national_free_entry_route`) were left untouched — note this contradicts the
   master doc's claim that all 11 were blank; actual pre-state was 8 blank.
   The 5 conditions-only / ACL rules (`vic_`, `qld_`, `wa_`, `tas_`,
   `national_acl_compliance`) were **deliberately left blank**: a blank trigger
   already means "applies to every competition", so inventing an `always`
   trigger would add a 15th reference record for no behavioural gain.

## Verified end state
- 26/26 subcategories with resolved `category_id`; 0 unresolved.
- 6/6 ChallengeCategory records with resolved `category_id`.
- 0 Vote, 0 VotingConfiguration, 0 PromoterAppointment records remain.
- 11 RegulatoryRule records: 6 mapped to a trigger, 5 intentionally unconditional.

## Not touched in this phase
`Challenge`, `Entry`, the `Vote` **schema**, and every compliance-gate entity —
per the Phase 0 instruction.

## Next
**Phase 1 — Challenge core + cutover start.** Blocked on D2 preconditions (a)–(c):
locate/inventory the upstream app (ID `69341410f89d26a8fc73a4d1`), export all real
data, and record the account decision (migrate upstream users vs universal
re-registration) — before any Challenge rebuild or seed regeneration (D3).