import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { secrets } from "base44:runtime";
import { verifyCustomSession } from '../../shared/customSession.ts';

// Entry comments for the public entry feed.
//   action: 'list' → { comments: [...] }
//   action: 'create' → { comment }
// Identity comes from the platform session when present, otherwise from the
// signed challenge-portal session token — never from client-supplied names.
export default async function (req) {
  try {
    const body = await req.json().catch(() => ({}));
    const platform = createClientFromRequest(req);
    const service = platform.asServiceRole;

    if (body.action === 'list') {
      const comments = await service.entities.EntryComment.filter(
        { entry_id: String(body.entry_id || '') }, '-created_date', 100
      );
      return Response.json({ comments });
    }

    if (body.action !== 'create') {
      return Response.json({ error: "Unknown action" }, { status: 400 });
    }

    let identity = null;
    const user = await platform.auth.me().catch(() => null);
    if (user?.email) {
      identity = { email: user.email, name: user.full_name || user.email };
    } else {
      const payload = await verifyCustomSession(
        String(body.session_token || ''), secrets.get("CHALLENGE_API_KEY") || ''
      );
      if (payload) identity = { email: payload.email, name: payload.name || payload.email };
    }
    if (!identity) return Response.json({ error: "Please sign in to comment." }, { status: 401 });

    const text = String(body.text || '').trim();
    if (!text) return Response.json({ error: "Comment cannot be empty." }, { status: 400 });

    const comment = await service.entities.EntryComment.create({
      entry_id: String(body.entry_id || ''),
      challenge_id: String(body.challenge_id || ''),
      text: text.slice(0, 500),
      author_name: identity.name,
    });
    return Response.json({ comment });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}