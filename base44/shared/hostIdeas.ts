// Host Ideas API — the single source of truth for /host-idea submissions.
// Nothing about an idea is stored in this app's own database any more; every
// read and write goes to the external Host Ideas API.
const BASE = 'https://base44.app/api/apps/69341410f89d26a8fc73a4d1/functions/hostIdeaApi';

export const IDEA_STATUSES = ['new', 'in_review', 'contacted', 'accepted', 'declined'];

// Same key the other Challenge APIs use.
const key = () => Deno.env.get('CHALLENGE_API_KEY') || '';

/** GET — e.g. ideaApiGet({ action: 'ideas', limit: '200' }) */
export async function ideaApiGet(params: Record<string, string>) {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${BASE}?${qs}`, { headers: { 'x-api-key': key() } });
  return await res.json().catch(() => ({}));
}

/** POST — e.g. ideaApiPost({ action: 'set_status', id, status }) */
export async function ideaApiPost(body: Record<string, unknown>) {
  const res = await fetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': key() },
    body: JSON.stringify(body),
  });
  return await res.json().catch(() => ({}));
}

// /host-idea posts an ENQUIRY to the parent's hostChallengeRequest endpoint
// (the public enquiry/idea API per the integration guide §1A). hostIdeaApi is
// still used for listing and status updates.
const HOST_CHALLENGE_REQUEST_API =
  'https://base44.app/api/apps/69341410f89d26a8fc73a4d1/functions/hostChallengeRequest';

/** Create a public enquiry (HostChallengeRequest) on the parent app. */
export async function createEnquiry(payload: Record<string, unknown>) {
  const res = await fetch(HOST_CHALLENGE_REQUEST_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': key() },
    body: JSON.stringify(payload),
  });
  return await res.json().catch(() => ({}));
}

const MARKER = '\n\n--- wizard details (do not edit) ---\n';

/** Wizard answers → Host Ideas API fields. Everything the API has no column
 *  for travels as a JSON block at the end of additional_notes. */
export function toIdeaPayload(body: any) {
  const answers = {
    source: 'tell_us_your_idea',
    name: String(body.name || '').trim(),
    email: String(body.email || '').trim().toLowerCase(),
    phone: String(body.phone || '').trim(),
    organisation_name: String(body.organisation_name || '').trim(),
    org_kind: String(body.org_kind || '').trim(),
    org_state: String(body.org_state || '').trim(),
    org_abn: String(body.org_abn || '').trim(),
    org_type: String(body.org_type || '').trim(),
    for_own_organisation: body.for_own_organisation !== false,
    beneficiary_name: String(body.beneficiary_name || '').trim(),
    beneficiary_notes: String(body.beneficiary_notes || '').trim(),
    activity_type: String(body.activity_type || '').trim(),
    age_groups: Array.isArray(body.age_groups) ? body.age_groups : [],
    participants: body.participants || '',
    reach: body.reach || '',
    winner_method: body.winner_method || '',
    scope: body.scope || '',
    timing: body.timing || '',
    prize_pool: body.prize_pool || '',
    budget: body.budget || '',
    extra_notes: String(body.extra_notes || '').trim(),
    primary_objective: body.primary_objective || '',
    secondary_objectives: Array.isArray(body.secondary_objectives) ? body.secondary_objectives : [],
    participant_next_action: String(body.participant_next_action || '').trim(),
    rules_expectations: Array.isArray(body.rules_expectations) ? body.rules_expectations : [],
    rules_notes: String(body.rules_notes || '').trim(),
    judging_source: body.judging_source || '',
    invited_judges: Array.isArray(body.invited_judges)
      ? body.invited_judges
          .map((j: any) => ({ name: String(j?.name || '').trim(), email: String(j?.email || '').trim().toLowerCase() }))
          .filter((j: any) => j.name && j.email)
      : [],
    platform_judges_notes: String(body.platform_judges_notes || '').trim(),
    template_id: body.template_id || '',
    template_name: body.template_name || '',
  };

  const idea_answers = [
    { group: 'Contact', label: 'Contact name', value: answers.name },
    { group: 'Contact', label: 'Email', value: answers.email },
    { group: 'Contact', label: 'Phone', value: answers.phone },
    { group: 'Contact', label: 'Organisation', value: answers.organisation_name },
    { group: 'Contact', label: 'Organisation type', value: answers.org_type },
    { group: 'The idea', label: 'Challenge title', value: body.challenge_title },
    { group: 'The idea', label: 'Description', value: body.challenge_description },
    { group: 'The idea', label: 'Activity type', value: answers.activity_type },
    { group: 'Goals', label: 'Primary objective', value: answers.primary_objective },
    { group: 'Goals', label: 'Secondary objectives', value: (answers.secondary_objectives || []).join(', ') },
    { group: 'Goals', label: 'Participant next action', value: answers.participant_next_action },
    { group: 'Rules', label: 'Rules expectations', value: (answers.rules_expectations || []).join(', ') },
    { group: 'Rules', label: 'Rules notes', value: answers.rules_notes },
    { group: 'Format', label: 'Age groups', value: (answers.age_groups || []).join(', ') },
    { group: 'Format', label: 'Participants', value: answers.participants },
    { group: 'Format', label: 'Reach', value: answers.reach },
    { group: 'Format', label: 'Winner method', value: answers.winner_method },
    { group: 'Format', label: 'Judging source', value: answers.judging_source },
    { group: 'Format', label: 'Invited judges', value: (answers.invited_judges || []).map((j: any) => `${j.name} (${j.email})`).join(', ') },
    { group: 'Format', label: 'Platform judges notes', value: answers.platform_judges_notes },
    { group: 'Practical', label: 'Scope', value: answers.scope },
    { group: 'Practical', label: 'Timing', value: answers.timing },
    { group: 'Practical', label: 'Prize pool', value: answers.prize_pool },
    { group: 'Practical', label: 'Budget', value: answers.budget },
    { group: 'Notes', label: 'Extra notes', value: answers.extra_notes },
    { group: 'Template', label: 'Template', value: answers.template_name },
  ].filter((item) => item.value && String(item.value).trim());

  return {
    company_name: answers.organisation_name || answers.name,
    contact_name: answers.name,
    contact_email: answers.email,
    phone: answers.phone,
    working_title: String(body.challenge_title || '').trim(),
    description: String(body.challenge_description || '').trim(),
    challenge_type: answers.activity_type,
    main_goal: answers.primary_objective,
    participants: answers.beneficiary_name || answers.org_type,
    expected_participants: answers.participants,
    geographic_scope: answers.reach,
    launch_timeframe: answers.timing,
    budget_range: answers.budget,
    prize_format: answers.prize_pool,
    heard_about: answers.template_name ? `Template: ${answers.template_name}` : '',
    idea_answers,
    source_app: '53-challenges',
    additional_notes: `${answers.extra_notes}${MARKER}${JSON.stringify(answers)}`,
  };
}

/** API record → the shape the admin dashboard already renders. */
export function fromIdeaRecord(rec: any) {
  const notes = String(rec?.additional_notes || '');
  const at = notes.indexOf(MARKER);
  let answers: any = {};
  if (at >= 0) {
    try { answers = JSON.parse(notes.slice(at + MARKER.length)); } catch { answers = {}; }
  }
  const extra = at >= 0 ? notes.slice(0, at) : notes;
  return {
    id: rec?.id,
    challenge_title: rec?.working_title || '',
    challenge_description: rec?.description || '',
    review_status: IDEA_STATUSES.includes(rec?.status) ? rec.status : 'new',
    is_read: !!rec?.is_read,
    created_date: rec?.submitted_at || rec?.created_date || '',
    answers: {
      name: rec?.contact_name || '',
      email: rec?.contact_email || '',
      phone: rec?.phone || '',
      organisation_name: rec?.company_name || '',
      ...answers,
      extra_notes: answers.extra_notes || extra,
    },
  };
}