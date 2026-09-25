import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { secrets } from "base44:runtime";
import { verifyCustomSession } from '../../shared/customSession.ts';
import { hostOwnedChallenges, ownsEntry, findDelegateActor } from '../../shared/hostChallengeAccess.ts';

// Proxy to the main 53 Challenges app's moderateSubmission endpoint, so the
// host/admin review queue reads and decides on the real submissions there.
//   action: 'queue'  → { entries: [...], is_admin, is_host }
//     optional challenge_id → only that challenge's pending entries
//   action: 'decide' → { entry_id, decision: 'approve'|'reject', reason }
const ENDPOINT = "https://base44.app/api/apps/69341410f89d26a8fc73a4d1/functions/moderateSubmission";

export default async function (req) {
  try {
    const body = await req.json().catch(() => ({}));
    const apiKey = secrets.get("CHALLENGE_API_KEY") || "";
    const base44 = createClientFromRequest(req);
    const sr = base44.asServiceRole;

    // Portal sessions pass their token straight through. Hosts signed in with a
    // platform session use service-to-service auth: the main site derives
    // permissions from the acting user's own role/memberships.
    // The API key only identifies the app, so the main site always needs to know
    // which person is acting. Resolve that from the platform session, or from
    // the signed challenge-portal session token.
    const payload = { ...body };
    if (!payload.acting_email) {
      const user = await base44.auth.me().catch(() => null);
      if (user?.email) {
        // Only the email — the main site looks the person up by address; a
        // platform user id means nothing there.
        payload.acting_email = user.email;
      } else if (payload.session_token) {
        const session = await verifyCustomSession(String(payload.session_token), apiKey);
        if (session?.email) payload.acting_email = session.email;
      }
    }
    if (!payload.acting_email) return Response.json({ error: "Please sign in" }, { status: 401 });

    const ask = async (data) => {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey },
        body: JSON.stringify(data),
      });
      const parsed = await res.json().catch(() => ({ error: "Unexpected response from the main site." }));
      return { ok: res.ok, status: res.status, data: parsed };
    };
    const askQueue = async (actingEmail) => (await ask({ action: 'queue', acting_email: actingEmail })).data;

    const wanted = String(body.challenge_id || '');
    const filterEntries = (list) =>
      (list || []).filter((e) => !wanted || String(e.challenge_id || '') === wanted);

    // ── Queue ─────────────────────────────────────────────────────────
    if (body.action === 'queue') {
      const mine = await ask({ ...payload, action: 'queue' });
      if (!mine.ok) return Response.json(mine.data, { status: mine.status });
      if (mine.data?.is_admin || mine.data?.is_host) {
        return Response.json({ ...mine.data, entries: filterEntries(mine.data.entries) });
      }
      // Not a reviewer on the main site — but this app may have given them the
      // challenge, in which case we ask on their behalf.
      const owned = await hostOwnedChallenges(sr, payload.acting_email);
      if (!owned.ids.size && !owned.titles.size) return Response.json(mine.data, { status: 200 });
      const delegate = await findDelegateActor(sr, askQueue);
      if (!delegate.email) return Response.json(mine.data, { status: 200 });
      const entries = filterEntries((delegate.queue?.entries || []).filter((e) => ownsEntry(owned, e)));
      return Response.json({ entries, is_admin: false, is_host: true, reviewer_email: payload.acting_email });
    }

    // ── Decision ──────────────────────────────────────────────────────
    if (body.action === 'decide') {
      const direct = await ask(payload);
      if (direct.ok && !direct.data?.error) return Response.json(direct.data, { status: 200 });
      const owned = await hostOwnedChallenges(sr, payload.acting_email);
      if (!owned.ids.size && !owned.titles.size) return Response.json(direct.data, { status: direct.status });
      const delegate = await findDelegateActor(sr, askQueue);
      const entry = (delegate.queue?.entries || []).find((e) => String(e.id) === String(payload.entry_id));
      if (!delegate.email || !entry || !ownsEntry(owned, entry)) {
        return Response.json(direct.data, { status: direct.status });
      }
      const viaDelegate = await ask({ ...payload, acting_email: delegate.email });
      return Response.json(viaDelegate.data, { status: viaDelegate.ok ? 200 : viaDelegate.status });
    }

    const other = await ask(payload);
    return Response.json(other.data, { status: other.ok ? 200 : other.status });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}