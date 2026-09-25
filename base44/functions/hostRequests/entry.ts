import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { secrets } from 'base44:runtime';
import { verifyCustomSession } from '../../shared/customSession.ts';
import {
  HOST_EDITABLE_FIELDS,
  isRequestEditable,
  pushRequestToParent,
} from '../../shared/hostRequestLock.ts';
import { listMyRequests, getRequest } from '../../shared/hostRequestApi.ts';

// A host's own challenge requests (enquiries).
//   'my_requests'    → the signed-in host's own requests only
//   'get_request'    → one of their own requests
//   'update_request' → edit one of their own requests, but only while it is
//                      still open. Approved/closed requests are refused here,
//                      server-side, so the UI lock cannot be bypassed.
//
// Ownership is always derived server-side from the session (never from the
// request body), so one host can never read or edit another host's request.

const REQUIRED = ['company_name', 'contact_name', 'contact_email', 'challenge_title', 'challenge_description', 'audience_description'];

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || '');

    // ── Identity: platform session first, signed custom session second ──
    const platformUser = await base44.auth.me().catch(() => null);
    let email = '';
    let isAdmin = false;
    if (platformUser) {
      email = String(platformUser.email || '').toLowerCase();
      isAdmin = platformUser.role === 'admin';
    } else if (body.session_token) {
      const payload = await verifyCustomSession(
        String(body.session_token),
        secrets.get('CHALLENGE_API_KEY') || '',
      ).catch(() => null);
      if (payload) email = String(payload.email || '').toLowerCase();
    }
    if (!email) return Response.json({ error: 'Please sign in to see your requests.' }, { status: 401 });

    /** Every request belonging to this host — pulled from the parent API
     *  (the single source of truth). No local copy is kept. */
    const loadMine = async () => {
      try {
        return await listMyRequests(secrets.get('CHALLENGE_API_KEY') || '', email);
      } catch {
        return [];
      }
    };

    const loadOwn = async (id) => {
      if (!id) return null;
      try {
        return await getRequest(secrets.get('CHALLENGE_API_KEY') || '', id, email);
      } catch {
        return null;
      }
    };

    if (action === 'my_requests') {
      return Response.json({ requests: await loadMine() });
    }

    if (action === 'get_request') {
      const record = await loadOwn(String(body.id || ''));
      if (!record) return Response.json({ error: 'Request not found' }, { status: 404 });
      return Response.json({ request: record, editable: isRequestEditable(record.status) });
    }

    if (action === 'update_request') {
      const id = String(body.id || '');
      const record = await loadOwn(id);
      // Not theirs (or does not exist) → identical answer either way, so this
      // never reveals that another host's request exists.
      if (!record) return Response.json({ error: 'Request not found' }, { status: 404 });

      if (!isRequestEditable(record.status)) {
        return Response.json({
          error: record.status === 'approved'
            ? 'This request has been approved, so it can no longer be edited.'
            : 'This request is closed, so it can no longer be edited.',
          locked: true,
          status: record.status,
        }, { status: 409 });
      }

      // Only host-editable fields are ever applied — status, internal notes and
      // ownership can never be changed from here.
      const patch: any = {};
      for (const f of HOST_EDITABLE_FIELDS) {
        if (body.patch?.[f] !== undefined) patch[f] = body.patch[f];
      }
      const next = { ...record, ...patch };
      const missing = REQUIRED.filter((f) => !String(next[f] || '').trim());
      if (missing.length) {
        return Response.json({ error: 'Please complete all required fields.' }, { status: 400 });
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(next.contact_email || ''))) {
        return Response.json({ error: 'Please enter a valid contact email address.' }, { status: 400 });
      }
      if (!next.start_date || !next.end_date) {
        return Response.json({ error: 'Please give a start and end date.' }, { status: 400 });
      }
      if (next.end_date <= next.start_date) {
        return Response.json({ error: 'The end date must be after the start date.' }, { status: 400 });
      }

      // Re-push the updated details to the parent — the single source of truth.
      const requestId = await pushRequestToParent(next, {
        update_of_request_id: record.parent_request_id || record.id || '',
      }).catch(() => '');

      return Response.json({ ok: true, request: { ...record, ...patch }, pushed: !!requestId });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}