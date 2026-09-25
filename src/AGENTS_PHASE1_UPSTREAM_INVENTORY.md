# D2(a) — Upstream App Inventory (read-only, 8 Aug 2026)

Source: upstream app `69341410f89d26a8fc73a4d1` via the `publicChallengeApi`
endpoint, using only its GET actions (`challenges`, `entries`, `votes`,
`classes`). No write action was called. Per Standing Rule 7 this was the
explicitly instructed read-only step of D2(a).

## Challenges — 24 total
- Status: 16 active · 6 completed · 2 archived
- Stage: 10 state · 6 national · 1 grand_final · 7 unset
- Season: 13 "Good 2026" · 1 "2026" · 10 unset
- Categories (upstream enum, underscore form): visual_arts 5 · performance_voice 4 ·
  writing_storytelling 4 · dance 3 · digital_creativity 3 · photography 3 ·
  open_experimental 1 · 1 blank
- 1 title is QA-flagged ("QA End-to-End Test Challenge", archived)
- **A third upstream category enum exists** (`dance`, `writing_storytelling`,
  underscore-delimited) matching neither this app's legacy enum nor the canonical
  six. Mapping is a Phase 1 task.

## Entries — 103 total (queried per challenge; the unfiltered call returns 0)
- All 103 are status `approved`
- Spread across 10 challenges only; 14 challenges have none
- **`submission_count` on challenge records is not real.** Challenges report a
  combined 3,561 submissions while only 103 entry records exist — the six
  archived/completed challenges report 334–847 each but return 15 entries each.
  Treat the reported counter as display decoration, never as data.
- Entry fields exposed: id, challenge_id, challenge_title, title, description,
  work_url, thumbnail_url, media_type, media_source, external_link,
  selected_prompt_title, creator_name, user_name, division_name, state, category,
  status, vote_count, community_votes, combined_score, final_score, is_finalist,
  is_winner, is_division_winner, submitted_at, created_date

## Votes — no vote records retrievable
The `votes` action returns exactly the same per-challenge counts as `entries`
(103 total, identical per challenge) — it returns entry records carrying vote
tallies, **not individual vote records**. The upstream vote store is therefore
**not exportable through this API**.

## Classes — 53 total, 14 QA-flagged
Marketplace/class data, out of scope for the challenge engine.

## Users — NOT retrievable
The public API exposes **no email field on any record** (0 creator emails, 0
voter emails across all 103 entries). User accounts cannot be counted or exported
through this endpoint.

## Blockers for D2(b) and D2(c) — owner action required
1. **User accounts** cannot be inventoried or exported via the API. This needs
   dashboard access to app `69341410f89d26a8fc73a4d1` (user count + export).
2. **Individual vote records** cannot be exported via the API. Either dashboard
   export, or the explicit decision to discard the upstream vote store at
   cutover (permitted by the master doc's "reconciled or explicitly discarded").
3. **The account decision (D2c)** — migrate upstream users vs universal
   re-registration — remains an owner product decision, now unavoidable because
   option 1 above may prove impossible.

## Assessment of what is worth migrating
103 approved entries across 10 challenges, of which a QA test challenge and
several uniform 15-entry sets look seeded. No exportable votes. No exportable
users. The real-data case for migration is weaker than D2 anticipated — but the
decision stays with the owner.

**Phase 1 build remains blocked** until (b) export and (c) the account decision
are recorded.