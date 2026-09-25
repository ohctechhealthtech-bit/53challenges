// Which host requests (PartnerInquiry records) a host may still edit, and the
// payload map used when pushing a request to the main domain's request API.
//
// The lock is enforced HERE, server-side, so a direct function invoke can never
// edit a request that has been approved (or otherwise closed).

const HOST_REQUEST_API =
  'https://base44.app/api/apps/69341410f89d26a8fc73a4d1/functions/hostChallengeRequest';

/** Statuses where the host may still edit their own request. */
export const OPEN_STATUSES = ['new', 'planning', 'contacted', 'in-progress'];

/** Fields the host is allowed to change on their own request. */
export const HOST_EDITABLE_FIELDS = [
  'company_name', 'company_website', 'industry', 'abn',
  'contact_name', 'contact_email', 'contact_phone',
  'challenge_title', 'challenge_type', 'challenge_goal', 'challenge_description',
  'audience_description', 'audience_size', 'geographic_scope',
  'launch_timing', 'start_date', 'end_date',
  'estimated_budget', 'prize_format', 'additional_notes', 'how_heard',
];

export function isRequestEditable(status: string) {
  return OPEN_STATUSES.includes(String(status || 'new'));
}

/** Date / date-time form value → ISO 8601 string, or '' when blank/invalid. */
export function toIsoDate(v: any): string {
  if (!v) return '';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString();
}

/** Drops keys whose value is '', null, undefined or an empty array. */
export function compactPayload<T extends Record<string, any>>(obj: T): Partial<T> {
  const out: any = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === '' || v === null || v === undefined) continue;
    if (Array.isArray(v) && v.length === 0) continue;
    out[k] = v;
  }
  return out;
}

/** PartnerInquiry field names → main domain request API field names. */
export function toRequestApiPayload(form: any) {
  return compactPayload({
    company_name: form.company_name,
    website: form.company_website || '',
    industry: form.industry || '',
    contact_name: form.contact_name,
    contact_email: form.contact_email,
    phone: form.contact_phone || '',
    working_title: form.challenge_title || '',
    challenge_type: form.challenge_type || '',
    main_goal: form.challenge_goal || '',
    description: form.challenge_description || '',
    participants: form.audience_description || '',
    expected_participants: form.audience_size || '',
    geographic_scope: form.geographic_scope || '',
    launch_timeframe: form.launch_timing || '',
    start_date: toIsoDate(form.start_date),
    end_date: toIsoDate(form.end_date),
    voting_end_date: toIsoDate(form.voting_end_date),
    cover_image: form.cover_image || '',
    category: form.category || form.challenge_type || '',
    age_divisions: Array.isArray(form.age_divisions) ? form.age_divisions : [],
    accepted_entry_types: Array.isArray(form.accepted_entry_types) ? form.accepted_entry_types : [],
    budget_range: form.estimated_budget || '',
    prize_format: form.prize_format || '',
    additional_notes: form.additional_notes || '',
    heard_about: form.how_heard || '',
    source_app: '53-challenges',
  });
}

/** Sends a request payload to the main domain. Returns its request id (or ''). */
export async function pushRequestToParent(form: any, extra: any = {}): Promise<string> {
  const res = await fetch(HOST_REQUEST_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...toRequestApiPayload(form), ...extra }),
  }).catch(() => null);
  const data = res ? await res.json().catch(() => ({})) : {};
  return String(data?.request_id || data?.id || '');
}