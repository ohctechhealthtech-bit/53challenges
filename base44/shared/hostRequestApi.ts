// Reads a host's own challenge enquiries from the parent app's adminChallengeApi
// (hostRequests.list / hostRequests.get), so this child app never stores a
// local copy. The parent is the single source of truth — deletions there are
// reflected here immediately, with no sync needed.
//
// Field names on the parent differ from this app's PartnerInquiry schema, so
// `fromParentRequest` maps them back to the names the UI expects.

const DEFAULT_ADMIN_BASE =
  'https://base44.app/api/apps/69341410f89d26a8fc73a4d1/functions/adminChallengeApi';

function adminBase(override?: string): string {
  return override || DEFAULT_ADMIN_BASE;
}

function toDateOnly(v: any): string {
  if (!v) return '';
  const s = String(v);
  // Already a yyyy-mm-dd value
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

/** Parent request object → PartnerInquiry field names the UI expects. */
export function fromParentRequest(r: any): any {
  if (!r) return null;
  return {
    id: r.id,
    parent_request_id: r.id,
    company_name: r.company_name || '',
    company_website: r.website || '',
    industry: r.industry || '',
    abn: r.abn || '',
    contact_name: r.contact_name || '',
    contact_email: r.contact_email || '',
    contact_phone: r.phone || '',
    challenge_title: r.working_title || '',
    challenge_type: r.challenge_type || '',
    challenge_goal: r.main_goal || '',
    challenge_description: r.description || '',
    audience_description: r.participants || '',
    audience_size: r.expected_participants || '',
    geographic_scope: r.geographic_scope || '',
    launch_timing: r.launch_timeframe || '',
    start_date: toDateOnly(r.start_date),
    end_date: toDateOnly(r.end_date),
    estimated_budget: r.budget_range || '',
    prize_format: r.prize_format || '',
    additional_notes: r.additional_notes || '',
    how_heard: r.heard_about || '',
    status: r.status || 'new',
    submitted_at: r.submitted_at || '',
    group: r.group || '',
    converted_challenge_id: r.challenge_id || r.converted_challenge_id || '',
  };
}

async function callParent(
  action: string,
  params: any,
  apiKey: string,
  baseOverride?: string,
): Promise<any> {
  if (!apiKey) throw new Error('CHALLENGE_API_KEY secret not set');
  const res = await fetch(adminBase(baseOverride), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
    body: JSON.stringify({ action, params: params || {} }),
  });
  const text = await res.text();
  let json: any;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`Parent returned non-JSON (HTTP ${res.status})`);
  }
  if (json.ok === false) {
    throw new Error(json.error?.message || 'Parent API error');
  }
  return json.data;
}

/** Every request belonging to a host (matched on contact_email), mapped to the
 *  PartnerInquiry field shape. Optionally filtered to a single group. */
export async function listMyRequests(
  apiKey: string,
  email: string,
  baseOverride?: string,
): Promise<any[]> {
  const data = await callParent('hostRequests.list', {}, apiKey, baseOverride);
  const rows = Array.isArray(data?.requests) ? data.requests : [];
  const e = String(email || '').toLowerCase();
  return rows
    .filter((r) => String(r.contact_email || '').toLowerCase() === e)
    .map(fromParentRequest)
    .filter(Boolean)
    .sort((a, b) => String(b.submitted_at || '').localeCompare(String(a.submitted_at || '')));
}

/** One request by id (must belong to the host), full record, mapped. */
export async function getRequest(
  apiKey: string,
  id: string,
  email: string,
  baseOverride?: string,
): Promise<any | null> {
  const data = await callParent('hostRequests.get', { id }, apiKey, baseOverride);
  const req = data?.request;
  if (!req) return null;
  if (email && String(req.contact_email || '').toLowerCase() !== String(email).toLowerCase()) {
    return null;
  }
  return fromParentRequest(req);
}