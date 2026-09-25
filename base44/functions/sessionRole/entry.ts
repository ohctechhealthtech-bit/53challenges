// Resolves the platform role for a custom (Challenge-API) login session.
//
// Custom logins carry whatever user object the upstream Challenge API returns,
// which has no notion of this app's admin role. Admin-only screens therefore
// locked out users who ARE admins in this app. This function verifies the
// signed session token server-side and returns the role stored on the app's
// own User record for that email.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { secrets } from 'base44:runtime';
import { verifyCustomSession } from '../../shared/customSession.ts';

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const apiKey = secrets.get('CHALLENGE_API_KEY');

    const session = await verifyCustomSession(body.session_token || '', apiKey);
    if (!session) return Response.json({ error: 'Invalid session' }, { status: 401 });

    const users = await base44.asServiceRole.entities.User.filter({ email: session.email });
    const role = users?.[0]?.role || 'user';
    return Response.json({ email: session.email, role });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}