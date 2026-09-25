import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import {
  normEmail, upsertGuardian, linkChild, applyGuardianDecision,
} from '../../shared/guardianHelper.ts';

// Guardian Portal — guardian-facing API.
// Identity is ALWAYS the authenticated account email; a guardian can only see
// and decide requests addressed to their own email.
//
//   action: 'register'      → { name, relationship, mobile, address } claim/update guardian record
//   action: 'me'            → guardian record + linked children + pending count
//   action: 'link_child'    → { child_name, child_email }
//   action: 'unlink_child'  → { child_id }
//   action: 'list_requests' → all approval requests for this guardian
//   action: 'activity'      → linked children's entries (title/challenge/status only)
//   action: 'approve'       → { request_id }
//   action: 'decline'       → { request_id, reason } (reason required)
//   action: 'revoke'        → { request_id, reason } withdraw a previously granted approval
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user?.email) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const action = body.action;
    const sr = base44.asServiceRole;
    const email = normEmail(user.email);

    const getGuardian = async () => {
      const list = await sr.entities.Guardian.filter({ email }, '-created_date', 1).catch(() => []);
      return list?.[0] || null;
    };

    // ── register / update guardian profile ────────────────────────────
    if (action === 'register') {
      const guardian = await upsertGuardian(sr, {
        email,
        name: String(body.name || user.full_name || ''),
        relationship: String(body.relationship || ''),
        mobile: String(body.mobile || ''),
        address: String(body.address || ''),
      });
      await sr.entities.Guardian.update(guardian.id, { user_id: user.id, verified: true });
      return Response.json({ ok: true, guardian: { ...guardian, user_id: user.id, verified: true } });
    }

    // ── me ─────────────────────────────────────────────────────────────
    if (action === 'me') {
      const guardian = await getGuardian();
      if (!guardian) return Response.json({ guardian: null, children: [], pending_count: 0 });
      const children = await sr.entities.GuardianChild.filter(
        { guardian_id: guardian.id, status: 'active' }, '-created_date', 50
      ).catch(() => []);
      const pending = await sr.entities.GuardianApprovalRequest.filter(
        { guardian_email: email, status: 'pending' }, '-created_date', 100
      ).catch(() => []);
      return Response.json({ guardian, children: children || [], pending_count: (pending || []).length });
    }

    // ── link_child ────────────────────────────────────────────────────
    if (action === 'link_child') {
      const guardian = await getGuardian();
      if (!guardian) return Response.json({ error: 'Register as a guardian first' }, { status: 400 });
      const child_email = normEmail(body.child_email);
      const child_name = String(body.child_name || '').trim();
      if (!child_email || !child_name) return Response.json({ error: 'child_name and child_email required' }, { status: 400 });
      if (child_email === email) return Response.json({ error: 'A child email must be different from your own' }, { status: 400 });
      const link = await linkChild(sr, guardian, child_name, child_email);
      return Response.json({ ok: true, child: link });
    }

    // ── unlink_child ──────────────────────────────────────────────────
    if (action === 'unlink_child') {
      const links = await sr.entities.GuardianChild.filter({ id: String(body.child_id || '') }, '-created_date', 1).catch(() => []);
      if (!links?.length || normEmail(links[0].guardian_email) !== email) {
        return Response.json({ error: 'Child link not found' }, { status: 404 });
      }
      await sr.entities.GuardianChild.update(links[0].id, { status: 'revoked' });
      return Response.json({ ok: true });
    }

    // ── list_requests ─────────────────────────────────────────────────
    if (action === 'list_requests') {
      const requests = await sr.entities.GuardianApprovalRequest.filter(
        { guardian_email: email }, '-created_date', 200
      ).catch(() => []);
      return Response.json({ requests: requests || [] });
    }

    // ── activity: linked children's entries ──────────────────────────
    if (action === 'activity') {
      const guardian = await getGuardian();
      if (!guardian) return Response.json({ entries: [] });
      const children = await sr.entities.GuardianChild.filter(
        { guardian_id: guardian.id, status: 'active' }, '-created_date', 50
      ).catch(() => []);
      const emails = (children || []).map((c) => normEmail(c.child_email));
      const entries = [];
      for (const ce of emails) {
        const list = await sr.entities.Entry.filter({ creator_email: ce }, '-created_date', 50).catch(() => []);
        for (const e of list || []) {
          entries.push({
            id: e.id,
            child_email: ce,
            title: e.title,
            challenge_title: e.challenge_title,
            status: e.status,
            guardian_approval_status: e.guardian_approval_status || 'not_required',
            submitted_at: e.submitted_at || e.created_date,
            vote_count: e.vote_count || 0,
          });
        }
      }
      entries.sort((a, b) => String(b.submitted_at).localeCompare(String(a.submitted_at)));
      return Response.json({ entries });
    }

    // ── approve / decline / revoke ────────────────────────────────────
    if (action === 'approve' || action === 'decline' || action === 'revoke') {
      const requests = await sr.entities.GuardianApprovalRequest.filter(
        { id: String(body.request_id || '') }, '-created_date', 1
      ).catch(() => []);
      const request = requests?.[0];
      if (!request || normEmail(request.guardian_email) !== email) {
        return Response.json({ error: 'Approval request not found' }, { status: 404 });
      }
      const reason = String(body.reason || '').trim();
      if (action === 'decline' && !reason) {
        return Response.json({ error: 'A reason is required to decline' }, { status: 400 });
      }
      if (action === 'approve' && request.status !== 'pending') {
        return Response.json({ error: 'This request has already been decided' }, { status: 409 });
      }
      if (action === 'revoke' && request.status !== 'approved') {
        return Response.json({ error: 'Only an approved request can be revoked' }, { status: 409 });
      }

      // Ensure the guardian record is claimed (register-on-first-decision).
      let guardian = await getGuardian();
      if (!guardian) {
        guardian = await upsertGuardian(sr, { email, name: user.full_name || request.guardian_name || '' });
        await sr.entities.Guardian.update(guardian.id, { user_id: user.id, verified: true });
      }
      // Keep the child linked for the dashboard.
      if (request.child_email) {
        await linkChild(sr, guardian, request.child_name, request.child_email).catch(() => {});
      }

      const decision = action === 'approve' ? 'approved' : action === 'decline' ? 'declined' : 'revoked';
      const updated = await applyGuardianDecision(sr, request, decision, reason);

      // Notify the entrant — best-effort, never blocks the decision.
      await base44.functions.invoke('guardianStatusNotify', {
        action: 'notify_decision', request_id: request.id,
      }).catch(() => {});

      return Response.json({ ok: true, request: updated });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}