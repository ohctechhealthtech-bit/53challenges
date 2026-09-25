import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { secrets } from 'base44:runtime';
import { isAdminCaller } from '../../shared/adminAuth.ts';

// Proxy to the parent app's hostRequestQuote function — handles Stripe
// payment link creation, emailing the applicant, and payment status checks.
// Admin-only: the quote panel is part of the admin dashboard.
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const isAdmin = await isAdminCaller(base44, body.session_token || '', secrets.get('CHALLENGE_API_KEY') || '');
    if (!isAdmin) return Response.json({ ok: false, error: { code: 'forbidden', message: 'Admins only' } }, { status: 403 });

    const action = body.action;
    if (!action) return Response.json({ ok: false, error: { code: 'missing_action', message: 'Missing action' } }, { status: 400 });

    const key = secrets.get('CHALLENGE_API_KEY');
    if (!key) return Response.json({ ok: false, error: { code: 'no_key', message: 'CHALLENGE_API_KEY secret not set' } }, { status: 500 });

    // Derive the parent's hostRequestQuote URL from the public API base.
    const publicBase = secrets.get('CHALLENGE_API_BASE_URL') || 'https://base44.app/api/apps/69341410f89d26a8fc73a4d1/functions/publicChallengeApi';
    const quoteUrl = publicBase.replace(/\/[^/]*$/, '/hostRequestQuote');

    const res = await fetch(quoteUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': key },
      body: JSON.stringify({
        action,
        session_token: body.session_token || '',
        request_id: body.request_id,
        amount: body.amount,
        notes: body.notes,
      }),
    });
    const data = await res.json().catch(() => ({}));
    return Response.json(data, { status: res.status });
  } catch (error) {
    return Response.json({ ok: false, error: { code: 'proxy_error', message: error.message } }, { status: 500 });
  }
}