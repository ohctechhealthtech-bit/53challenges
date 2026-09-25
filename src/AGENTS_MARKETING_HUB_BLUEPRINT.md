# 53 Challenges — Marketing Hub Blueprint (v3, code-verified)

Supersedes blueprint v1 and v2. Every "current implementation" statement below was verified
against the live repository on 2026-08-09. Corrections from v2 are listed at the end.

This blueprint extends the existing `/marketing` page into an acquisition-focused marketing hub.
Keep the existing route, data, and working components; improve them incrementally rather than
building a second marketing system.

## Product concept

The hub should answer five questions for every challenge:

1. Who are we trying to attract?
2. What message and offer will make them join?
3. Which channels and partners will reach them?
4. Where are people dropping out of the funnel?
5. Which campaign produces verified registrations and submissions—not just impressions?

### Acquisition concepts specific to challenges

- Separate **contestants** (people who submit an entry) from **participants** (voters, supporters, attendees, sharers).
- Give every challenge a reusable seven-stage campaign: teaser, launch, education, social proof, countdown, voting, results.
- Generate audience-specific variants: student, professional, parent, creator, local community, corporate team, open public.
- Use referral links and UTM tags on every asset so registrations can be attributed to a campaign, creator, partner, or ambassador.
- Reward meaningful actions such as verified registration or approved submission; avoid rewarding raw clicks.
- Show the organiser a funnel warning when landing visits are healthy but registrations or submissions are weak.

---

## VERIFIED CURRENT STATE (read from the repo, not assumed)

**Route:** `/marketing`, registered in `src/App.jsx` inside the `RoleGuard` layout route block.
`RoleGuard` (`src/components/RoleGuard.jsx`) allows admins only; `Marketing.jsx` then applies a
*second, looser* check that also admits `role === 'creator'`. These two checks disagree — see
Phase 1.2.

**Files:**
- `src/pages/Marketing.jsx` — 45-line shell, 6 tabs, no header beyond an `h1`.
- `src/lib/marketing.js` — 13 thin wrappers + 4 local constant arrays.
- `base44/functions/marketingHub/entry.ts` — 13 actions in one handler.
- `src/components/marketing/` — `AudienceTable.jsx`, `CampaignBuilder.jsx`, `OrganisationsPanel.jsx`,
  `PipelineList.jsx`, `SponsorManager.jsx`, `ShareCardGenerator.jsx`.

**Existing tab keys (in `TABS`):** `audience`, `campaigns`, `orgs`, `pipeline`, `sponsors`, `cards`.
Default tab is `audience`.

**Entities in use:** `AudienceMember`, `EmailCampaign`, `Organisation`, `PartnerInquiry`,
`SponsorProfile`, `User`.

**Existing `marketingHub` actions (13):**
`addAudience`, `sendLifecycle`, `mySponsorProfile` (authenticated) and
`listAudience`, `unsubscribe`, `createCampaign`, `sendCampaign`, `createOrganisation`,
`listOrganisations`, `organisationLeaderboard`, `listSponsors`, `saveSponsor`, `deleteSponsor`
(gated by an `adminActions` array that admits `role === 'admin' || role === 'creator' || is_admin`).

**Verified defects to fix (do not treat these as hypothetical):**
1. `CampaignBuilder.jsx` calls `base44.entities.EmailCampaign.list('-created_date', 200)` directly
   from the browser.
2. `PipelineList.jsx` calls `base44.entities.PartnerInquiry.list(...)` **and**
   `base44.entities.PartnerInquiry.update(id, { pipeline_status })` directly from the browser.
3. `ShareCardGenerator.jsx` calls `base44.integrations.Core.GenerateImage` directly from the
   browser and swallows every failure in `catch (e) {}` — a provider error renders nothing at all.
4. `AudienceTable`, `OrganisationsPanel`, `SponsorManager` and `CampaignBuilder` all use
   `catch { ... }` to reduce errors to an empty list — failures are indistinguishable from
   "no records".
5. `listAudience` loads up to 10,000 `AudienceMember` records and filters in memory
   (`matchesSegment`).
6. `src/lib/marketing.js` hardcodes `CATEGORIES` as 10 display strings
   (`Writing, Music, Visual Art, Photography, Dance, Film, Design, Comedy, Craft, Spoken Word`).
   These match **neither** the canonical `Category` entity **nor** the `Challenge.category` enum
   (`visual-arts, photography, writing, digital-creativity, performance-voice, open-experimental`).
   Any segment filtering on category is therefore unreliable today.
7. `EmailCampaign.status` only ever takes `draft` or `sent`. There is no approval workflow.
8. `ORG_KINDS` in `marketing.js` lists 4 kinds; the `Organisation` entity enum allows 11.
   Creating an organisation from this page cannot express most valid kinds.

**Capability gap vs. this blueprint:** the current page covers roughly two of the ten target tabs.
Absent entirely: Command Centre, acquisition funnel, any `AcquisitionEvent` tracking, UTM/tracked
links, referrals/ambassadors, content calendar, growth analytics, connected channels, campaign
approval workflow, and role separation.

---

## Ready-to-paste implementation prompt

```text
Upgrade the EXISTING 53 Challenges marketing hub. Do not create a second page, do not change the
route, and do not discard existing data or working features.

PRIMARY DECISION
Extend /marketing in place. Preserve the six existing features and their records. Add missing
capabilities around them. Refactor unsafe client calls through the server function, but keep the
visible behaviour familiar so current administrators do not lose their workflow.

PRODUCT PURPOSE
Turn the current marketing administration page into a challenge-acquisition command centre.
Measure how each campaign recruits contestants who register and submit entries; participants who
vote, attend, share, or support; creators and ambassadors who bring verified participants; and
organisations and sponsors that grow a challenge.

Success is measured primarily with registration_verified, entry_submitted, and entry_approved
events — not sends, impressions, clicks, votes, or image generation.

IMPLEMENTATION ORDER

PHASE 1 — SECURITY AND DATA-CONSISTENCY FOUNDATION
Complete this before adding new dashboard features.

1. Move all privileged browser operations behind marketingHub server actions:
   - CampaignBuilder must stop calling base44.entities.EmailCampaign.list. Add listCampaigns to
     marketingHub plus a wrapper in src/lib/marketing.js.
   - PipelineList must stop calling base44.entities.PartnerInquiry.list and .update. Add
     listPipeline and updatePipelineStatus server actions plus client wrappers.
   - ShareCardGenerator must stop calling base44.integrations.Core.GenerateImage in the browser.
     Add generateShareCard to marketingHub and call the integration server-side.
   - Return structured, user-visible errors. Remove every silent catch block, including the
     `catch { setX([]) }` patterns in AudienceTable, OrganisationsPanel, SponsorManager and
     CampaignBuilder, which currently make a failed request look like an empty dataset.

2. Reconcile authorization. Today RoleGuard admits admins only, while Marketing.jsx and the
   marketingHub adminActions check also admit role === 'creator'. Decide the intended audience and
   make the route guard, the page guard, and the server guard agree. Then replace the single broad
   adminActions check with action-level permissions:
   - admin: full access, approval, publishing, sponsor deletion, channel connections;
   - marketer: audience, campaign creation/editing, assets, scheduling, outreach, analytics —
     no destructive admin-only actions;
   - analyst: read-only dashboard and analytics;
   - viewer: no marketing access.
   If the User entity cannot safely hold a marketing role, add MarketingRoleAssignment
   (user_id, role, permissions[], status, created_by, timestamps). Existing admins must retain
   access during migration. Server-side authorization is authoritative; UI gating is cosmetic.

3. Stop loading 10,000 audience records and filtering in memory. Update listAudience to accept
   server-side filters, search, cursor/page and page_size; return items, total, and page metadata.

4. Replace the hardcoded CATEGORIES array with categories loaded from the canonical Category
   entity via a listCanonicalCategories action. Note the existing three-way mismatch between
   marketing.js CATEGORIES, the Category entity, and the Challenge.category enum. Store canonical
   IDs or slugs and add a legacy display mapping so existing AudienceMember.category_interests
   values still render and filter. Do the same for ORG_KINDS, which currently exposes 4 of the
   Organisation entity's 11 valid kinds.

5. Keep unsubscribe suppression authoritative on the server. sendCampaign and all lifecycle and
   outreach actions must exclude unsubscribed or invalid recipients. Preserve and report
   sent_count, skipped_unregistered, skipped_unsubscribed, failed_count and audience_count.
   Base44 SendEmail reaches registered app users only — surface that limitation in the UI rather
   than working around it, until a compliant external provider is connected.

PHASE 2 — RESTRUCTURE THE EXISTING PAGE WITHOUT REBUILDING IT

Keep src/pages/Marketing.jsx as the shell and keep it under ~60 lines; every tab body belongs in
its own component file under src/components/marketing/. Upgrade the header to:
- eyebrow: "53 CHALLENGES · GROWTH OPERATIONS";
- heading: "Turn every challenge into a movement.";
- challenge selector, date range, global search, alerts, and a Create campaign CTA.

Tabs, in this order, mapping existing tab keys to their new positions:
1. Command Centre    — new, becomes the default tab (replaces 'audience' as default)
2. Audience          — existing 'audience' / AudienceTable, plus pagination and canonical categories
3. Campaigns         — existing 'campaigns' / CampaignBuilder, upgraded into Campaign Studio + list
4. Organisations     — existing 'orgs' / OrganisationsPanel, plus tracked links and referrals
5. Outreach          — existing 'pipeline' / PipelineList, renamed in the UI only
6. Sponsors          — existing 'sponsors' / SponsorManager
7. Creative Assets   — existing 'cards' / ShareCardGenerator, plus generated copy and assets
8. Calendar          — new
9. Analytics         — new
10. Connections      — new

Do not change the existing tab state keys while moving them; renaming is a UI label change only.
Keep each existing component working while it is upgraded. Do not delete entity records or make
users recreate campaigns, organisations, inquiries, sponsors, or audience members.

PHASE 3 — COMMAND CENTRE

Add CommandCentre.jsx and make it the default tab. Include:
- KPI cards: verified registrations, approved submissions, landing-view-to-registration
  conversion, registration-to-submission conversion, active campaigns, cost per verified
  registration, days to the nearest challenge deadline.
- Acquisition funnel: impression → landing_view → registration_started → registration_verified →
  entry_started → entry_submitted → entry_approved.
- Campaign performance table: challenge, audience, status, channel mix, budget/spend, verified
  registrations, submissions, conversion, next action.
- Needs Attention panel: high funnel drop-off, approaching deadlines, campaigns awaiting approval,
  missing tracking links, provider errors, unapproved assets, low-performing channels.
- Filters: challenge, campaign, date range, audience, channel, location, organisation, referral
  partner.
- Every conversion rate must display its numerator and denominator.
- Empty state must explain that analytics appear once tracked events arrive. Never render
  zero-value performance cards as though they were real measurements. This matches the existing
  product rule that live challenge cards hide unverified stats rather than showing false zeros.

PHASE 4 — UPGRADE CAMPAIGNBUILDER INTO A CAMPAIGN STUDIO

Preserve existing EmailCampaign creation/sending and the four lifecycle templates in
marketingHub (welcome, entry_confirmed, voting_open, results_announced). Add an omnichannel
MarketingCampaign parent record. Existing EmailCampaign records may remain standalone or link via
marketing_campaign_id; do not destructively migrate them.

Campaign brief fields: challenge_id; objective (recruit_contestants, recruit_voters,
drive_submissions, activate_ambassadors, attract_sponsors, reengage_incomplete); audience segment;
location; phase (teaser, launch, education, social_proof, countdown, voting, results); tone;
incentive; channels[]; start/end date; budget; destination URL; owner; optional
organisation/partner.

Add generateCampaignKit to marketingHub — implemented with base44.integrations.Core.InvokeLLM and
a response_json_schema so the result is structured, not free text. It returns editable: campaign
name and core message; audience insight; landing-page eyebrow, headline, supporting copy, CTA and
FAQ; short/medium/long social variants; email subject, preview text and body; SMS/WhatsApp copy;
creator/organisation outreach copy; hashtags and image brief; seven-day content plan; tracked URL
with UTM values; suggested A/B test.

Users can edit, copy, regenerate one asset, save draft, submit for review, approve if permitted,
schedule, pause, duplicate, archive, and open analytics.

Campaign statuses: draft → in_review → approved → scheduled → active → paused/completed/archived.

Activation rules:
- A campaign cannot become active without challenge_id, objective, audience, CTA, destination URL,
  tracking parameters, owner, start/end date, and at least one approved asset.
- Warn if the campaign end date is after the challenge deadline. Read the deadline from the native
  Challenge entity (submission_ends_at / voting_ends_at), not from any upstream API.
- Keep an audit trail for submit, approve, schedule, send, pause and archive.

PHASE 5 — ACQUISITION TRACKING AND ATTRIBUTION

Add these entities without replacing current entities. Note this adds 8 entities to an app that
already has 82; confirm the schema increase before creating them.

MarketingCampaign — challenge_id, name, objective, audience_segment, location, phase, tone,
  incentive, channels[], status, start_at, end_at, budget, spend, owner_id, destination_url,
  utm_source, utm_medium, utm_campaign, organisation_id, created_by, approved_by, approved_at.
CampaignAsset — campaign_id, email_campaign_id, type, platform, title, body, media_url, status,
  scheduled_at, published_at, external_post_id, metrics{}, created_by.
AcquisitionEvent — challenge_id, campaign_id, tracked_link_id, organisation_id,
  referral_partner_id, anonymous_id, user_id, event_type, channel, source, medium, content,
  occurred_at, metadata{}. Allowed event_type: impression, landing_view, registration_started,
  registration_verified, entry_started, entry_submitted, entry_approved, vote_cast, share,
  attendance_confirmed. Append-only. Never expose personal participant data through analytics.
TrackedLink — challenge_id, campaign_id, organisation_id, referral_partner_id, code,
  destination_url, short_url, utm_source, utm_medium, utm_campaign, utm_content, status,
  click_count, created_by.
ReferralPartner — challenge_id, organisation_id, audience_member_id, display_name, partner_type,
  code, reward_type, reward_value, status, risk_flags[].
ReferralConversion — referral_partner_id, tracked_link_id, challenge_id, campaign_id, user_id,
  event_type, verified, risk_flags[], occurred_at.
MarketingRoleAssignment — user_id, role, permissions[], status, created_by.
ChannelConnection — platform, account_name, connection_type, status, permissions[], last_sync_at,
  error_message, created_by. Never store raw provider secrets in an entity; use app secrets.

Do not declare id, created_date, updated_date or created_by_id — they are built in.

Add server actions and matching thin wrappers in src/lib/marketing.js:
dashboardSummary(filters), listCampaigns(filters), getCampaign(id), saveCampaign(payload),
generateCampaignKit(payload), submitCampaign(id), approveCampaign(id), scheduleCampaign(payload),
updateCampaignStatus(payload), generateShareCard(payload), listPipeline(filters),
updatePipelineStatus(payload), buildTrackedLink(payload), referralLeaderboard(filters),
campaignAnalytics(filters), listCalendar(filters), listConnections(),
saveConnection(payload) [admin only], listCanonicalCategories().

recordAcquisitionEvent must NOT live inside marketingHub, because marketingHub requires an
authenticated user and acquisition events arrive from anonymous public traffic. Create a separate
narrow public ingestion function with schema validation, an event-type allowlist, rate limiting,
deduplication/idempotency, and no ability to read data or invoke other actions.

Adding 20+ actions will push marketingHub well past its current 214 lines. Split the handler into
shared modules under base44/shared/ (authorization, validation, analytics aggregation) that the
function imports, and keep the client API stable.

PHASE 6 — ORGANISATIONS, REFERRALS, AND OUTREACH

Extend OrganisationsPanel instead of replacing it: preserve existing signup_code links and the
leaderboard; add challenge-specific tracked links and UTM values; show clicks, verified
registrations, approved submissions, conversion and last activity; rank by verified registrations
or approved submissions rather than the current entry_count + vote_count sum; allow copying either
the plain signup link or a tracked link.

Upgrade PipelineList into Outreach: keep existing PartnerInquiry records and their
pipeline_status values (new, in_discussion, confirmed, live); add optional fit score, organisation
category, audience size, location, last contact, next follow-up, agreed deliverables, campaign_id,
tracked_link_id and attributed conversions; extend stages to prospect/new, contacted, replied,
in_discussion, confirmed, live, completed, declined — mapping the four existing values forward
without rewriting stored records; add visible loading, empty, error and save states.

Keep SponsorManager and SponsorProfile. Add challenge/campaign attribution and sponsor performance
only where data exists. Never expose private sponsor contact details in general analytics.

PHASE 7 — CREATIVE ASSETS, CALENDAR, ANALYTICS, CONNECTIONS

Creative Assets: retain ShareCardGenerator; route generation through generateShareCard; show
validation, progress, provider failures, retry, the generated image, a copyable URL, and
save-to-campaign. Render generated images with the Image component from @/components/ui/image,
not a bare img tag.

Calendar: month and week views of approved/scheduled CampaignAsset records; filter by challenge,
campaign, platform, owner and phase; reschedule with permission checks; colour-code the seven
phases. Drag-and-drop, if used, must use @hello-pangea/dnd — the only DnD library installed.

Analytics: funnel and trend views by challenge, campaign, audience, channel, location,
organisation, referral partner and UTM source; registrations over time, verified registrations,
submissions, approval rate, conversion by channel, cost per verified registration, cohort
completion; distinguish vanity metrics from acquisition outcomes; export aggregated CSV only
(reuse src/lib/csv.js) and never export private contestant fields. Charts use recharts.

Connections: display email, SMS/WhatsApp, social, analytics, ad and webhook connections with type,
status, permissions, last sync and an actionable error message; only admins may connect,
reconnect or remove a provider; never send provider credentials to the browser.

DESIGN AND UX
- React, Tailwind, lucide-react, and the app's existing dark design tokens: container-tight,
  bg-card, border-border, text-muted-foreground, grad-bg, c53-input, rounded-2xl.
- The app theme is DARK (--background: 222 33% 6%) with a red/coral primary. Do NOT introduce the
  light #F8F6F1 canvas, lime #C7F36B accent, or hardcoded zinc/white utility classes from the
  reference starter — they conflict with the shipped theme.
- Never hardcode colours in JSX; use mapped token classes only.
- Desktop should feel like a campaign control room; mobile must stack cleanly and keep primary
  actions reachable.
- Accessible labels, keyboard navigation, visible focus states, semantic buttons and tables,
  confirmation for destructive actions, skeleton loading, helpful empty states, inline/toast
  feedback. Respect prefers-reduced-motion, consistent with the rest of the app.
- Use real data when available. Clearly label demo data and never mix it into production totals.

ACCEPTANCE CRITERIA
1. /marketing remains the only marketing route and all six existing features still work.
2. AudienceMember, EmailCampaign, Organisation, PartnerInquiry, SponsorProfile and User data
   remains intact.
3. CampaignBuilder, PipelineList and ShareCardGenerator perform no privileged entity or
   integration calls from the browser.
4. Route guard, page guard and server guard agree on who may access marketing, and every action
   has server-side action-level authorization.
5. Audience filtering is server-side and paginated, and uses canonical categories with legacy
   compatibility.
6. Command Centre computes real funnel metrics from AcquisitionEvent and explains empty data
   instead of rendering zeros.
7. Campaigns support challenge, objective, tracking, approval, scheduling and lifecycle statuses.
8. Organisation and referral attribution reaches verified registrations and approved submissions.
9. No empty catch blocks remain; every failure is visible and actionable.
10. Private contestant details, provider secrets and privileged entity access never reach the
    marketing client.

IMPLEMENTATION STYLE
- Work incrementally in the phases above; Phase 1 ships before any new dashboard feature.
- Reuse and refactor existing components; never duplicate them.
- Add entity fields and new entities non-destructively; entity writes replace the whole schema, so
  always write the complete file.
- Keep src/lib/marketing.js wrappers thin and uniform:
  base44.functions.invoke('marketingHub', { action, ...payload }) returning r.data.
- After each phase, verify role permissions, existing workflows, mobile layout, empty and error
  states, and that existing data still renders.
```

---

## Integration note

Use the app's existing invocation pattern and the action name defined in Phase 4:

```jsx
const r = await base44.functions.invoke('marketingHub', {
  action: 'generateCampaignKit',
  challenge_id: form.challenge_id,
  objective: form.objective,
  audience_segment: form.audience,
  phase: form.phase,
  tone: form.tone,
  incentive: form.incentive,
  channels: form.channels,
});
setGenerated(r.data);
```

The most important analytics event is not a page view. Treat `registration_verified`,
`entry_submitted` and `entry_approved` as the primary conversion milestones, and make all campaign,
creator, referral and paid-channel reporting trace back to those events.

---

## What changed from v2

1. **Removed the React starter component.** It targeted a light `#F8F6F1` / lime theme with
   hardcoded `zinc`/`white` classes, its own `<main>` shell, and a seven-tab list that contradicted
   v2's own ten-tab plan. Pasting it would have fought both the dark theme and the Phase 2 layout.
2. **Fixed the integration note.** v2 still told the implementer to call a function named
   `generateChallengeCampaign`, which does not exist and contradicts Phase 4's `generateCampaignKit`.
3. **Added the guard contradiction** between `RoleGuard` (admin only), `Marketing.jsx`
   (admin *or* creator) and `marketingHub` (admin *or* creator) as an explicit Phase 1 task.
4. **Named the real defects with file and call sites**, including the four `catch {}` blocks that
   disguise failures as empty results — v2 mentioned only `ShareCardGenerator`.
5. **Documented the three-way category mismatch** and the `ORG_KINDS` 4-of-11 gap.
6. **Mapped the new tab order onto the existing tab state keys** so the restructure is a relabel,
   not a rewrite.
7. **Moved `recordAcquisitionEvent` out of the action list** — `marketingHub` calls `auth.me()`,
   so an anonymous ingestion endpoint cannot live inside it.
8. **Added platform constraints**: `InvokeLLM` with `response_json_schema` for kit generation,
   `@hello-pangea/dnd` for the calendar, `recharts` for charts, `src/lib/csv.js` for export,
   `@/components/ui/image` for generated media, no secrets in entities, built-in entity fields not
   redeclared, and a note that this adds 8 entities to an existing 82.