import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { secrets } from 'base44:runtime';
import { buildAdminQueues } from "../../shared/adminQueues.ts";
import { verifyCustomSession } from '../../shared/customSession.ts';

// Admin "needs your attention" summary — tiles and the waiting-longest list
// both come from this single response.
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};

    let user = await base44.auth.me().catch(() => null);
    // Admins signed in through the challenge portal have no platform session —
    // their signed session token identifies them, and the role comes from the
    // app's own User record.
    if (!user?.email && body.session_token) {
      const session = await verifyCustomSession(body.session_token, secrets.get('CHALLENGE_API_KEY'));
      if (session?.email) {
        const users = await base44.asServiceRole.entities.User.filter({ email: session.email });
        user = { email: session.email, role: users?.[0]?.role || 'user' };
      }
    }
    if (!user?.email) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(user.role === 'admin' || user.is_admin === true)) {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const queues = await buildAdminQueues(base44.asServiceRole);

    // Participant content submitted on the main 53 Challenges site counts
    // towards the admin's "Entries to approve" tile too.
    const mainSite = await base44.functions
      .invoke('moderateSubmission', { action: 'queue', acting_email: user.email })
      .then((r) => r?.data?.entries || [])
      .catch(() => []);
    const content = queues.find((q) => q.key === 'content');
    if (content && mainSite.length) {
      const known = new Set(content.items.map((i) => i.id));
      for (const e of mainSite) {
        if (known.has(String(e.id))) continue;
        content.items.push({
          id: String(e.id || ''),
          name: e.title || 'Untitled',
          since: e.submitted_at || e.created_date || '',
          note: e.challenge_title || '',
        });
      }
      content.count = content.items.length;
    }
    const total = queues.reduce((n, q) => n + q.count, 0);

    // Flatten to the oldest waiting items across every queue.
    const waiting = queues
      .flatMap((q) => q.items.map((i) => ({ ...i, queue: q.key, type: q.label, link: q.link })))
      .filter((i) => i.since)
      .sort((a, b) => new Date(a.since) - new Date(b.since))
      .slice(0, 8);

    return Response.json({ queues, total, waiting });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}