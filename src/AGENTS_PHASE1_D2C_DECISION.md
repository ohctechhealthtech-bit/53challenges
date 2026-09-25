# D2(c) — Account Migration Decision Record

**Date:** 8 Aug 2026
**Decision:** Universal re-registration. Upstream user accounts are NOT migrated.
**Status:** Drafted for owner sign-off. Phase 1 remains blocked until signed.

## Decision

All participants create new accounts in this app. No upstream account, password,
session, or profile is carried across. Upstream *content* (a small set of genuine
entries) may be imported as unlinked archival records — see "Content carry-over".

## Rationale

1. **Migration is not technically available.** The upstream public API exposes no
   email field on any record (D2(a): 0 creator emails, 0 voter emails across 103
   entries). Passwords never export from any platform. Any "migration" would mean
   fabricating accounts nobody can authenticate into, then forcing a reset on
   every one — re-registration with extra broken steps.
2. **Compliance requires a fresh consent capture.** Every participant needs a
   rights grant, marketing consent, and (where minors are involved) guardian
   consent under this app's framework. Imported accounts would carry none, so
   they would hit a consent wall on first login regardless. Re-registration
   collects it at the door, cleanly and with an auditable timestamp.
3. **The migration prize is negligible.** Only 12 genuine entries exist across 3
   live challenges (see below). There are no exportable vote records.
4. **Migration would import data debt** into a schema just repaired in Phase 0 —
   a third category enum, and fabricated `submission_count` values.

## Entry triage — 103 upstream entries

### Genuine — 12 entries, 3 challenges (carry-over candidates)
| Challenge | Entries | Creators | Media |
|---|---|---|---|
| Good 2026 State Round — Visual Arts (`6a7559492d9a1921965ce8e0`) | 1 | Manoj Dubey | youtu.be |
| The Imperfect Vessel Challenge (`6a603d0c7a7893b318d15ea6`) | 7 | Marcus Devlin, Hannah Whitfield, Mutsa Tapfuma James Simango, Shashwat, Lotte, Faraz Khan, vikas bisariya | base44.app, en.wikipedia.org |
| The Slumber Verse Challenge (`6a5efac97275f5fb7af5ba06`) | 4 | Thomas Nightingale, Eleanor Brightsea, Manoj, raj | base44.app, gutenberg.org, instagram.com |

Caveats: a few of these are themselves low-quality test submissions (titles
"ttt", "Love Styory") and some "media" is an external Wikipedia/Gutenberg link
rather than an uploaded work. Recommend a manual eyeball before import — the
realistic carry-over is closer to **8–10 entries**.

### Seeded — 90 entries, 6 challenges (DO NOT import)
Six challenges (`6a063b1aaa1b672088d09c28` … `2d`) each hold exactly 15 entries
authored by "Creator 1" … "Creator 15", all pointing at `via.placeholder.com`,
all dated 7–14 May 2026, titled "<Topic> Entry <N>". These are generated
fixtures. They are also the challenges reporting 334–847 fabricated submissions
against 15 actual records.

### QA — 1 entry (DO NOT import)
"QA Test Entry - My Journey" by "QA Test Participant" on the archived
QA End-to-End Test Challenge (`6a69f18fdc5901d95d231cb2`).

## Content carry-over rules

If the ~8–12 genuine entries are imported, they must be:
- attributed by `creator_name` text only, **linked to no User record**;
- flagged as archival/showcase, **excluded from voting, scoring, leaderboards,
  pathways, and prize ledgers**;
- imported with **no** `submission_count`, `vote_count`, or `combined_score`
  values from upstream — those figures are not trustworthy;
- mapped from the upstream category enum to the canonical six at import.

If any original creator later registers, their entries are **not** auto-claimed;
any linking is a manual admin action with the creator's confirmation.

## Consequence for cutover
The upstream vote store is **explicitly discarded** (it is not exportable — the
`votes` action returns entry tallies, not vote records). This satisfies the
master doc's "reconciled or explicitly discarded" requirement.

## Sign-off
- [ ] Owner approves universal re-registration
- [ ] Owner approves discarding the upstream vote store
- [ ] Owner confirms the genuine-entry carry-over list (or elects to import none)