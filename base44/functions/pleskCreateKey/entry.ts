import { getSecret } from '../../shared/secretsEnv.ts';

// Generates a fresh Plesk API key using admin login credentials.
// Calls POST /auth/keys with HTTP Basic Auth (admin:password).
// The new key has no IP restrictions so the Base44 backend can use it from any egress IP.
// Returns the new key — the admin then pastes it into the PLESK_API_KEY secret.
export default async function () {
  const baseUrl = getSecret('PLESK_BASE_URL').replace(/\/+$/, '');
  const adminPassword = getSecret('PLESK_ADMIN_PASSWORD');
  const adminUser = getSecret('PLESK_ADMIN_USER', 'admin');

  if (!baseUrl) return Response.json({ error: 'PLESK_BASE_URL not set' }, { status: 500 });
  if (!adminPassword) return Response.json({ error: 'PLESK_ADMIN_PASSWORD not set' }, { status: 500 });

  const credentials = btoa(`${adminUser}:${adminPassword}`);

  let res: Response;
  try {
    res = await fetch(`${baseUrl}/api/v2/auth/keys`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        login: adminUser,
        description: '53 Challenges backend (auto-generated, no IP restriction)',
      }),
      signal: AbortSignal.timeout(15000),
    });
  } catch (e: any) {
    return Response.json({ error: `Could not reach Plesk: ${e?.message || e}` }, { status: 502 });
  }

  const bodyText = await res.text();
  let body: any = null;
  try { body = JSON.parse(bodyText); } catch { /* non-JSON */ }

  if (res.status === 201 && body?.key) {
    return Response.json({
      success: true,
      key: body.key,
      message: 'New API key created. Copy it and update the PLESK_API_KEY secret, then run pleskDiagnostic to verify.',
    });
  }

  return Response.json({
    error: `Plesk returned HTTP ${res.status}`,
    detail: body || bodyText.slice(0, 300),
  }, { status: res.status });
}