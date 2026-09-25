# 53 Challenges — Form vs API Field Comparison

> Generated: 2026-08-05
> Compares every form field in the app against what the external Challenge API actually accepts, and lists the gaps.

---

## External APIs

The app talks to two external endpoints:

| # | Endpoint | Auth | Used by |
|---|---|---|---|
| 1 | `publicChallengeApi` (proxy via `challengeApi/entry.ts`) | `x-api-key` header (`CHALLENGE_API_KEY`) | Submit Entry, Become a Judge, Vote, Challenge/Entry listing |
| 2 | `hostChallengeRequest` (direct public endpoint) | None (public) | Host a Challenge form |

Both live on the external Base44 app `69341410f89d26a8fc73a4d1`.

---

## 1. Submit Entry Form

**Page:** `src/pages/SubmitEntry.jsx`
**API action:** `POST publicChallengeApi` → `{ action: "submit_entry", entry: {...} }`
**Backend function:** `challengeApi/entry.ts` (proxies the payload as-is)

### API Required Fields (enforced server-side)

These fields are validated by the external API — submission fails with a 400 error if any are missing:

| API field | Validation rule |
|---|---|
| `challenge_id` | Must reference a challenge that is **open for entries** |
| `title` | Non-empty string |

### API Optional Fields (accepted but not required)

The API accepts these fields and stores them when provided:

| API field | Source in form | Notes |
|---|---|---|
| `work_url` | `workText` (uploaded as .txt file) or `workLink` | Must be a valid URL |
| `category` | `challenge.category` (with `-` → `_`) | e.g. `art_craft_making` |
| `state` | `form.state` | AU state code |
| `creator_name` | `form.name` | Truncated to 80 chars |
| `creator_email` | `form.email` | |
| `description` | `form.description` | Truncated to 2000 chars |
| `date_of_birth` | `form.dob` | ISO date string |
| `guardian_full_name` | `form.guardianName` | Sent only when entrant is under 18 |
| `guardian_email` | `form.guardianEmail` | Sent only when entrant is under 18 |
| `guardian_consent_checked` | `form.guardianConsent` | Boolean, sent only when entrant is under 18 |

### ❌ Fields Collected in Form but NOT Sent to API

| Form field | UI label | What happens to it | Impact |
|---|---|---|---|
| `phone` | "Phone" | Collected, validated, displayed in review — **never included in the API payload** | Phone number is lost on submission |
| `city` | "City" | Collected, displayed in review — **never included in the API payload** | City is lost on submission |
| `division` | "Division" | Auto-assigned from DOB via `assignDivision()` — **never included in the API payload** | The API doesn't receive which division the entrant belongs to |
| `organisation` | "Organisation" (gated pathways only) | Used only for the local `checkPathwayEntry()` eligibility gate — **never included in the API payload** | Not stored on the entry record |
| `accessCode` | "Access code" (gated pathways only) | Used only for the local `checkPathwayEntry()` eligibility gate — **never included in the API payload** | Not stored on the entry record |

### Payload mapping (from `SubmitEntry.jsx` lines 103–118)

```js
const entry = {
  challenge_id: challenge.id,
  title: form.title.slice(0, 120),
  work_url,                          // from upload or link
  category: (challenge.category || '').replace(/-/g, '_'),
  state: form.state,
  creator_name: form.name.slice(0, 80),
  creator_email: form.email,
  description: (form.description || '').slice(0, 2000),
  date_of_birth: form.dob,
};
// Added only when entrant is a minor:
if (isMinor) {
  entry.guardian_full_name = form.guardianName;
  entry.guardian_email = form.guardianEmail;
  entry.guardian_consent_checked = form.guardianConsent;
}
```

**Missing from above:** `form.phone`, `form.city`, `form.division`, `form.organisation`, `form.accessCode`

---

## 2. Become a Judge Form

**Page:** `src/pages/BecomeJudge.jsx`
**API action:** `POST publicChallengeApi` → `{ action: "submit_judge_application", ...fields }`
**Backend function:** `challengeApi/entry.ts` (proxies the payload as-is)

### API Required Fields (enforced server-side)

Validation order matches the sequence below — the API checks them one at a time and returns the first failure:

| API field | Validation rule | Error message if missing/invalid |
|---|---|---|
| `full_name` | Non-empty | `"full_name is required"` |
| `email` | Valid email format | `"A valid email is required"` |
| `state` | Must be one of: `QLD`, `NSW`, `VIC`, `WA`, `SA`, `TAS`, `NT`, `ACT` | `"state must be one of: QLD, NSW, VIC, WA, SA, TAS, NT, ACT"` |
| `categories` | Array; must contain at least one **valid slug** (see below) | `"Select at least one category expertise"` |
| `experience` | Non-empty | (validated after categories) |
| `current_role` | Non-empty | (validated after experience) |
| `years_experience` | Non-empty | (validated after current_role) |

### Valid Category Slugs (accepted by the API)

The API rejects category values that don't match these slugs:

| Slug | Label in form |
|---|---|
| `visual_arts` | Visual Arts |
| `photography` | Photography |
| `writing_storytelling` | Writing & Storytelling |
| `digital_creativity` | Digital Creativity |
| `performance_voice` | Performance & Voice |
| `dance` | Dance |
| `open_experimental` | Open / Experimental |

> ⚠️ The form's `JUDGE_CATEGORIES` list (in `judges.js` line 6) uses the **old category names** (e.g. `"Art, Craft & Making"`) while the form UI correctly uses the new slugs from `JUDGE_APPLICATION_CATEGORIES`. The old list is not sent to the API — it's only used internally for `JudgeProfile` records.

### API Optional Fields (accepted but not required)

| API field | Source in form | Notes |
|---|---|---|
| `phone` | `form.phone` | |
| `availability` | `form.availability` | Array of availability slugs |
| `organisation` | `form.organisation` | |
| `previous_judging_experience` | `form.previous_judging_experience` | |
| `portfolio_url` | `form.portfolio_url` | |
| `conflict_of_interest` | `form.conflict_of_interest` | |
| `supporting_links` | `form.supporting_links` | |
| `supporting_files` | `uploads` | Array of `{ name, url }` objects |

### ❌ Fields Collected in Form but NOT Sent to API

| Form field | UI label | What happens to it | Impact |
|---|---|---|---|
| `consent_fair_judging` | "I confirm I will declare any conflicts of interest and judge fairly and independently." checkbox | Required by the form (`errors.consent_fair_judging`); validated client-side — **never included in the API payload** | The fairness declaration is not recorded server-side. This is a legally significant consent that exists only in the browser. |
| `consent_contact` | "I agree to be contacted about judging opportunities and accept the privacy policy." checkbox | Required by the form (`errors.consent_contact`); validated client-side — **never included in the API payload** | The contact/privacy consent is not recorded server-side. |

### Payload mapping (from `BecomeJudge.jsx` lines 102–118)

```js
const result = await challengeApi.submitJudgeApplication({
  full_name: form.name.trim(),
  email: form.email.trim().toLowerCase(),
  phone: form.phone.trim(),
  state: form.state,
  categories: form.categories,
  experience: form.experience.trim(),
  availability: form.availability,
  current_role: form.current_role.trim(),
  organisation: form.organisation.trim(),
  years_experience: form.years_experience,
  previous_judging_experience: form.previous_judging_experience.trim(),
  portfolio_url: form.portfolio_url.trim(),
  conflict_of_interest: form.conflict_of_interest.trim(),
  supporting_links: form.supporting_links.trim(),
  supporting_files: uploads.map((f) => ({ name: f.name, url: f.url })),
});
```

**Missing from above:** `form.consent_fair_judging`, `form.consent_contact`

> A local `JudgeProfile` entity is also created (lines 130–142), but it doesn't store consent fields either — only `experience`, `availability`, `conflict_of_interest`, `status`, and category info.

---

## 3. Host a Challenge Form

**Page:** `src/pages/HostChallenge.jsx`
**API endpoint:** `POST hostChallengeRequest` (direct public endpoint)
**Backend function:** `hostChallengeRequest/entry.ts` (maps form fields → API field names, then calls external API + saves local `PartnerInquiry`)

### API Required Fields (enforced server-side)

| API field | Validation rule | Error message if missing |
|---|---|---|
| `company_name` | Non-empty | `"Missing required fields: company_name, ..."` |
| `contact_name` | Non-empty | Included in the missing-fields list |
| `contact_email` | Non-empty + valid email | Included in the missing-fields list |
| `working_title` | Non-empty | Included in the missing-fields list |
| `description` | Non-empty | Included in the missing-fields list |

### Field Mapping (form → API)

The `hostChallengeRequest/entry.ts` backend function renames form fields before sending them to the external API:

| Form field | API field | Required by API? | Required by form? |
|---|---|---|---|
| `company_name` | `company_name` | ✅ Yes | ✅ Yes |
| `company_website` | `website` | No | No |
| `industry` | `industry` | No | No |
| `contact_name` | `contact_name` | ✅ Yes | ✅ Yes |
| `contact_email` | `contact_email` | ✅ Yes | ✅ Yes |
| `contact_phone` | `phone` | No | No |
| `challenge_title` | `working_title` | ✅ Yes | ✅ Yes |
| `challenge_type` | `challenge_type` | No | No (form marks required, but not in `required` array) |
| `challenge_goal` | `main_goal` | No | No |
| `challenge_description` | `description` | ✅ Yes | ✅ Yes |
| `audience_description` | `participants` | No | ✅ Yes (form-required, API does not require) |
| `audience_size` | `expected_participants` | No | No |
| `geographic_scope` | `geographic_scope` | No | No |
| `launch_timing` | `launch_timeframe` | No | No |
| `estimated_budget` | `budget_range` | No | No |
| `prize_format` | `prize_format` | No | No |
| `additional_notes` | `additional_notes` | No | No |
| `how_heard` | `heard_about` | No | No |
| *(implicit)* | `source_app` | No | Set to `"53-challenges"` by backend |

### ❌ Fields Collected in Form but NOT Sent to API

| Form field | UI label | What happens to it | Impact |
|---|---|---|---|
| `abn` | "ABN / business number (optional)" | Collected in the form — **not included in the `apiPayload` mapping** in `hostChallengeRequest/entry.ts` | ABN is saved to the local `PartnerInquiry` entity (via `...form_data` spread) but lost when sent to the external API |
| `consent_contact` | "I agree to be contacted about this enquiry and accept the privacy policy." checkbox | Required by the form (client-side check); saved to local `PartnerInquiry` via spread — **not included in the `apiPayload` mapping** | The privacy consent is not sent to the external API |

### Payload mapping (from `hostChallengeRequest/entry.ts` lines 30–50)

```js
const apiPayload = {
  company_name: form_data.company_name,
  website: form_data.company_website || '',
  industry: form_data.industry || '',
  contact_name: form_data.contact_name,
  contact_email: form_data.contact_email,
  phone: form_data.contact_phone || '',
  working_title: form_data.challenge_title || '',
  challenge_type: form_data.challenge_type || '',
  main_goal: form_data.challenge_goal || '',
  description: form_data.challenge_description || '',
  participants: form_data.audience_description || '',
  expected_participants: form_data.audience_size || '',
  geographic_scope: form_data.geographic_scope || '',
  launch_timeframe: form_data.launch_timing || '',
  budget_range: form_data.estimated_budget || '',
  prize_format: form_data.prize_format || '',
  additional_notes: form_data.additional_notes || '',
  heard_about: form_data.how_heard || '',
  source_app: '53-challenges',
};
```

**Missing from above:** `form_data.abn`, `form_data.consent_contact`

> Note: The full `form_data` (including `abn` and `consent_contact`) IS saved to the local `PartnerInquiry` entity via `await sr.entities.PartnerInquiry.create({ ...form_data, ... })` on line 69. So these fields are persisted locally — just not forwarded to the external API.

---

## Summary: All Missing Fields

| Form | Field | Form label | Severity | Recommendation |
|---|---|---|---|---|
| Submit Entry | `phone` | Phone | Medium | Add `phone` to the entry payload in `SubmitEntry.jsx` |
| Submit Entry | `city` | City | Medium | Add `city` to the entry payload |
| Submit Entry | `division` | Division | Low | Auto-assigned from DOB; add to payload or let the API compute it |
| Submit Entry | `organisation` | Organisation | Low | Only relevant for gated pathways; consider sending for audit trail |
| Submit Entry | `accessCode` | Access code | Low | Should NOT be sent (it's a credential, not data to store) |
| Become Judge | `consent_fair_judging` | Fairness declaration | **High** | Consent declaration should be recorded server-side for legal/audit purposes |
| Become Judge | `consent_contact` | Contact + privacy consent | **High** | Privacy consent should be recorded server-side for legal/audit purposes |
| Host Challenge | `abn` | ABN / business number | Medium | Add `abn` to the `apiPayload` mapping in `hostChallengeRequest/entry.ts` |
| Host Challenge | `consent_contact` | Privacy consent | **High** | Add `consent_contact` to the `apiPayload` mapping |

### Priority

1. **High — Consent fields (Judge + Host):** These are legally significant declarations. They are currently validated client-side only and never persisted to the external API. If the API supports them, they should be sent. If not, they should at minimum be stored in the local entity (Host Challenge does this via spread; Judge does not).

2. **Medium — Contact fields (Entry `phone`/`city`, Host `abn`):** These are useful business data that are collected but lost on submission. Easy to add to the payloads.

3. **Low — Division / organisation / accessCode (Entry):** `division` is auto-computed; `organisation` and `accessCode` are gate-check inputs rather than entry metadata. `accessCode` should NOT be sent to the API as it's a credential.
