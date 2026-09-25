import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { secrets } from "base44:runtime";
import { getOrganisation } from '../../shared/hostOrganisation.ts';
import { pendingEntries } from '../../shared/adminQueues.ts';
import { verifyCustomSession } from '../../shared/customSession.ts';

// Per-entry content approval.
//   action: 'queue'  → entries awaiting approval the caller may review
//   action: 'decide' → { entry_id, decision: 'approved'|'rejected', note }
//
// Permissions are decided here, never in the UI:
//   • admins review every entry and can override a host's decision
//   • a host reviews entries only on challenges owned by their organisation
//     AND only when that challenge is host-managed
//   • nobody else can read the queue or decide anything
const REVIEW_STATUSES = ['approved', 'rejected'];

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    const sr = base44.asServiceRole;
    const body = await req.json().catch(() => ({}));
    const action = body.action;

    // Hosts who signed in through the challenge login have no platform session —
    // their signed session token carries the identity instead.
    let email = user?.email ? String(user.email).toLowerCase().trim() : '';
    let userId = user?.id || '';
    if (!email) {
      const session = await verifyCustomSession(
        body?.session_token || '', secrets.get("CHALLENGE_API_KEY")
      );
      email = session?.email || '';
      userId = session?.uid || '';
    }
    if (!email) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const isAdmin = user?.role === 'admin' || user?.is_admin === true;

    // The host's own host-managed challenges — the only content a host may review.
    const hostChallenges = async () => {
      const org = await getOrganisation({ email }).catch(() => ({ found: false }));
      const orgId = org?.found ? org.organisation?.id : '';
      if (!orgId) return { orgId: '', challenges: [] };
      const list = await sr.entities.Challenge.filter(
        { host_organisation_id: orgId }, '-created_date', 200
      ).catch(() => []);
      return { orgId, challenges: (list || []).filter((c) => c.content_type === 'host_managed') };
    };

    if (action === 'queue') {
      const scope = body.scope === 'host' ? 'host' : 'admin';
      if (scope === 'admin' && !isAdmin) return Response.json({ error: 'Admin only' }, { status: 403 });

      let pending = [];
      if (scope === 'admin') {
        pending = await pendingEntries(sr);
      } else {
        const { challenges } = await hostChallenges();
        pending = await pendingEntries(sr, challenges.map((c) => c.id));
      }

      const titles = new Map();
      const items = [];
      for (const e of pending) {
        const cid = String(e.challenge_id || '');
        if (cid && !titles.has(cid)) {
          const c = await sr.entities.Challenge.get(cid).catch(() => null);
          titles.set(cid, c?.title || '');
        }
        items.push({
          id: e.id,
          challenge_id: cid,
          challenge_title: e.challenge_title || titles.get(cid) || 'Challenge',
          participant: e.creator_name || '',
          submitted_at: e.submitted_at || e.created_date,
          title: e.title,
          description: e.description || '',
          work_text: e.work_text || '',
          work_link: e.work_link || '',
          division: e.division || '',
          state: e.state || '',
        });
      }
      return Response.json({ entries: items, count: items.length });
    }

    if (action === 'decide') {
      const entry_id = String(body.entry_id || '');
      const decision = String(body.decision || '');
      const note = String(body.note || '').trim();
      if (!entry_id || !REVIEW_STATUSES.includes(decision)) {
        return Response.json({ error: 'entry_id and a valid decision are required' }, { status: 400 });
      }
      if (decision === 'rejected' && !note) {
        return Response.json({ error: 'Please give the participant a reason for the rejection.' }, { status: 400 });
      }

      const entry = await sr.entities.Entry.get(entry_id).catch(() => null);
      if (!entry) return Response.json({ error: 'Entry not found' }, { status: 404 });

      if (!isAdmin) {
        const { challenges } = await hostChallenges();
        const owned = challenges.find((c) => c.id === String(entry.challenge_id));
        if (!owned) {
          return Response.json(
            { error: 'You can only review content on your own host-managed challenges.' },
            { status: 403 }
          );
        }
      }

      const patch = {
        status: decision,
        review_note: note,
        reviewer_id: userId,
        reviewer_email: email,
        reviewed_at: new Date().toISOString(),
        moderated_at: new Date().toISOString(),
      };
      await sr.entities.Entry.update(entry_id, patch);
      try {
        await sr.entities.ComplianceAuditEvent.create({
          event_type: 'content_reviewed',
          challenge_id: String(entry.challenge_id || ''),
          actor_id: userId,
          actor_email: email,
          detail: `Entry ${entry_id} ${decision}${note ? `: ${note}` : ''} by ${isAdmin ? 'admin' : 'host'}.`,
        });
      } catch {}
      const { creator_email, ...safe } = { ...entry, ...patch };
      return Response.json({ ok: true, entry: safe });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}