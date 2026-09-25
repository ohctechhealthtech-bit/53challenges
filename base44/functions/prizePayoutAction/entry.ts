import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { canEditPayoutDetails } from '../../shared/prizePayoutHelper.ts';

// Two-person prize release. Payment status: Pending → Audited → Approved → Paid.
//   verify_identity   — the winner verifies identity + payment details
//                       (recorded before auditor sign-off). Authenticated user
//                       owning the entry, or admin can record on their behalf.
//   auditor_signoff   — auditor (auditor assignment or admin) marks the payout
//                       audited. Requires identity + payment details verified
//                       and the audit signed off. Status → audited.
//   admin_approve     — platform admin approves. Requires status 'audited'.
//                       Status → approved.
//   mark_paid         — platform admin records the payment. Requires 'approved'.
//                       Status → paid with paid_at + payment_ref.
export default async function(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const { action, payout_id, data } = body;
    if (!action || !payout_id) return Response.json({ error: 'Missing action/payout_id' }, { status: 400 });

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const sr = base44.asServiceRole;
    const isAdmin = user.role === 'admin';
    const now = new Date().toISOString();

    const payout = await sr.entities.PrizePayout.get(payout_id);
    if (!payout) return Response.json({ error: 'Payout not found', status: 404 });
    const competition_id = payout.competition_id;

    const canAudit = async () => {
      if (isAdmin) return true;
      const a = await sr.entities.CompetitionAssignment.filter({ competition_id }, '-assigned_at', 500);
      const mine = (a || []).some((x) => (x.judge_email || '').toLowerCase() === (user.email || '').toLowerCase() && x.role === 'auditor' && x.status === 'active');
      const judgeRole = (a || []).some((x) => (x.judge_email || '').toLowerCase() === (user.email || '').toLowerCase() && (x.role === 'judge' || x.role === 'manager') && x.status === 'active');
      if (judgeRole) return false; // role separation
      return mine;
    };

    if (action === 'verify_identity') {
      if (!(await canEditPayoutDetails(sr, payout, user))) {
        return Response.json({ error: 'You can only verify your own prize payout.' }, { status: 403 });
      }
      const updated = await sr.entities.PrizePayout.update(payout_id, {
        identity_verified: true,
        payment_details_verified: !!data?.payment_details_verified,
        payment_method: data?.payment_method || payout.payment_method,
        payee_name: data?.payee_name || payout.payee_name,
        guardian_name: data?.guardian_name || payout.guardian_name,
        payee_type: data?.payee_type || payout.payee_type,
        notes: data?.notes || payout.notes,
      });
      return Response.json({ success: true, payout: updated });
    }

    if (action === 'auditor_signoff') {
      if (!(await canAudit())) return Response.json({ error: 'Only the assigned auditor (or admin) can sign off a payout, and not for a competition they judge or manage.' }, { status: 403 });
      if (!payout.identity_verified || !payout.payment_details_verified) {
        return Response.json({ error: 'Winner must verify identity and payment details before auditor sign-off.' }, { status: 409 });
      }
      const review = (await sr.entities.AuditReview.filter({ competition_id }, '-created_date', 5))[0];
      if (!review || review.status !== 'signed_off') {
        return Response.json({ error: 'Audit must be signed off before prizes can be released.' }, { status: 409 });
      }
      const updated = await sr.entities.PrizePayout.update(payout_id, {
        status: 'audited',
        auditor_signoff_by: user.email,
        auditor_signoff_name: user.full_name || user.email,
        auditor_signoff_at: now,
      });
      return Response.json({ success: true, payout: updated });
    }

    if (action === 'admin_approve') {
      if (!isAdmin) return Response.json({ error: 'Admin only' }, { status: 403 });
      if (payout.status !== 'audited') {
        return Response.json({ error: 'Payout must be audited (auditor sign-off) before admin approval.' }, { status: 409 });
      }
      const updated = await sr.entities.PrizePayout.update(payout_id, {
        status: 'approved',
        admin_approval_by: user.email,
        admin_approval_name: user.full_name || user.email,
        admin_approval_at: now,
      });
      return Response.json({ success: true, payout: updated });
    }

    if (action === 'mark_paid') {
      if (!isAdmin) return Response.json({ error: 'Admin only' }, { status: 403 });
      if (payout.status !== 'approved') {
        return Response.json({ error: 'Payout must be approved before it can be marked paid.' }, { status: 409 });
      }
      const updated = await sr.entities.PrizePayout.update(payout_id, {
        status: 'paid',
        paid_at: now,
        payment_ref: data?.payment_ref || '',
      });
      return Response.json({ success: true, payout: updated });
    }

    return Response.json({ error: 'Unknown action: ' + action }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}