// Host Organisations API — the single source of truth for a host's
// organisation. Nothing about an organisation is stored in this app's own
// database: every read goes to this external API.
const BASE = 'https://base44.app/api/apps/69341410f89d26a8fc73a4d1/functions/hostOrganisationApi';

const key = () => Deno.env.get('CHALLENGE_API_KEY') || '';

async function call(body: Record<string, unknown>) {
  const res = await fetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': key() },
    body: JSON.stringify(body),
  });
  return await res.json().catch(() => ({}));
}

/** Look an organisation up by owner/member email, app user id, or org id. */
export async function getOrganisation(idents: { email?: string; user_id?: string; id?: string }) {
  const body: Record<string, unknown> = { action: 'organisation' };
  if (idents.email) body.email = String(idents.email).toLowerCase();
  else if (idents.user_id) body.user_id = idents.user_id;
  else if (idents.id) body.id = idents.id;
  else return { found: false, organisation: null, membership: null };

  const res = await call(body).catch(() => ({}));
  return {
    found: !!res?.found && !!res?.organisation,
    organisation: res?.organisation || null,
    membership: res?.membership || null,
    is_owner: !!res?.is_owner,
  };
}

/** Everyone attached to an organisation. */
export async function getOrganisationMembers(organisationId: string) {
  const res = await call({ action: 'members', organisation_id: organisationId }).catch(() => ({}));
  return Array.isArray(res?.members) ? res.members : [];
}