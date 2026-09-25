import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Guardian notification sender (best-effort).
//   action: 'notify_request'  → { request_id } email the guardian about a pending approval
//   action: 'notify_decision' → { request_id } email the entrant about the guardian's decision
//
// NOTE: the platform email service only delivers to registered app users.
// A guardian who has not registered yet will not receive the email — the
// Guardian Dashboard (/guardian) is the reliable channel; sends are recorded
// as best-effort and never block the flow.
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { action, request_id } = body;
    if (!request_id) return Response.json({ error: 'request_id required' }, { status: 400 });

    const sr = base44.asServiceRole;
    const requests = await sr.entities.GuardianApprovalRequest.filter({ id: String(request_id) }, '-created_date', 1).catch(() => []);
    if (!requests || !requests.length) return Response.json({ error: 'Request not found' }, { status: 404 });
    const r = requests[0];

    const appUrl = req.headers.get('origin') || '';

    if (action === 'notify_request') {
      let sent = false;
      try {
        await sr.integrations.Core.SendEmail({
          to: r.guardian_email,
          from_name: '53 Challenges',
          subject: `Approval needed: ${r.child_name || 'your child'} entered "${r.challenge_title || 'a challenge'}"`,
          body: [
            `Hi ${r.guardian_name || 'there'},`,
            ``,
            `${r.child_name || 'A young entrant'} has submitted the entry "${r.entry_title}" to the challenge "${r.challenge_title}" on 53 Challenges and listed you as their parent/guardian.`,
            ``,
            `The entry stays on hold until you approve it. To review and approve or decline:`,
            `1. Sign in (or register) on 53 Challenges with this email address.`,
            `2. Open the Guardian Dashboard: ${appUrl}/guardian`,
            ``,
            `If you did not expect this, you can decline the request with a reason from the same page.`,
          ].join('\n'),
        });
        sent = true;
      } catch { /* guardian not registered — dashboard remains the channel */ }
      if (sent) {
        await sr.entities.GuardianApprovalRequest.update(r.id, { notified_at: new Date().toISOString() }).catch(() => {});
      }
      return Response.json({ ok: true, sent });
    }

    if (action === 'notify_decision') {
      let sent = false;
      const decision = r.status === 'approved' ? 'approved' : r.status === 'declined' ? 'declined' : 'updated';
      try {
        await sr.integrations.Core.SendEmail({
          to: r.child_email,
          from_name: '53 Challenges',
          subject: `Your entry "${r.entry_title}" was ${decision} by your guardian`,
          body: [
            `Hi ${r.child_name || 'there'},`,
            ``,
            r.status === 'approved'
              ? `Great news — your guardian approved your entry "${r.entry_title}" for "${r.challenge_title}". It now continues through the normal review process.`
              : `Your guardian ${decision} your entry "${r.entry_title}" for "${r.challenge_title}".${r.decline_reason ? ` Reason: ${r.decline_reason}` : ''}`,
          ].join('\n'),
        });
        sent = true;
      } catch { /* entrant email not registered */ }
      return Response.json({ ok: true, sent });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}