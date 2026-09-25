import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { secrets } from "base44:runtime";
import { fetchChallengeApi } from '../../shared/challengeApiHelper.ts';
import { verifyCustomSession } from '../../shared/customSession.ts';

// Returns all challenge entries submitted by the given user (matched by email).
// Uses the upstream my_entries action for efficient server-side filtering
// instead of fetching all challenges + entries client-side.
export default async function(req) {
  try {
    // Identity comes from the authenticated session only — a user_email in the
    // request body is ignored, so nobody can read another person's entries.
    const base44 = createClientFromRequest(req);
    const apiKey = secrets.get("CHALLENGE_API_KEY");
    const baseUrl = secrets.get("CHALLENGE_API_BASE_URL");

    const user = await base44.auth.me().catch(() => null);
    // Entrants who signed in through the challenge login have no platform
    // session — their signed session token carries the identity instead.
    let email = user?.email ? String(user.email).trim().toLowerCase() : '';
    if (!email) {
      const body = await req.json().catch(() => ({}));
      const session = await verifyCustomSession(body?.session_token || '', apiKey);
      email = session?.email || '';
    }
    if (!email) return Response.json({ error: "Unauthorized" }, { status: 401 });

    // Native entries live in this app.
    const sr = base44.asServiceRole;
    const nativeRaw = await sr.entities.Entry.filter({ creator_email: email }, '-created_date', 500).catch(() => []);
    // Editability is decided server-side and sent to the UI so the labels can
    // never disagree with what the update action will actually allow.
    const challenges = new Map();
    const native = [];
    for (const raw of nativeRaw || []) {
      const { creator_email, ...rest } = raw;
      const cid = String(rest.challenge_id || '');
      if (cid && !challenges.has(cid)) {
        challenges.set(cid, await sr.entities.Challenge.get(cid).catch(() => null));
      }
      const ch = challenges.get(cid);
      const subEnd = ch?.submission_ends_at ? new Date(ch.submission_ends_at).getTime() : null;
      const challengeClosed = (!!subEnd && subEnd <= Date.now()) ||
        (!!ch && ch.source === 'native' && ch.lifecycle_status !== 'entry_open');
      let editable = true;
      let locked_reason = '';
      if (rest.status === 'approved') {
        editable = false;
        locked_reason = 'Approved — locked. This entry can no longer be edited.';
      } else if (challengeClosed) {
        editable = false;
        locked_reason = 'This challenge has closed — entries can no longer be edited.';
      }
      native.push({ ...rest, editable, locked_reason });
    }

    const data = await fetchChallengeApi('my_entries', { email }, apiKey, baseUrl).catch(() => ({}));
    // Entries submitted on the main 53 Challenges site stay editable until a
    // reviewer has decided on them; the update is pushed back to that site.
    const upstream = (data.entries || []).map((e) => {
      const status = String(e.status || 'pending');
      const pending = status === 'pending' || status === 'rejected';
      return {
        ...e,
        main_site: true,
        editable: pending,
        locked_reason: pending ? '' : (e.locked_reason ||
          'This entry has been reviewed — it can no longer be edited.'),
      };
    });
    const entries = [...native, ...upstream];

    return Response.json({ entries, count: entries.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}