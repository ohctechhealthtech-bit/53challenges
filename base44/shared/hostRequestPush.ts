// A submitted host application (/host-apply) becomes a host request in two
// places: a PartnerInquiry record in this app (what admins review in the
// dashboard) and a request on the main domain's request API.
//
// Both are built from ONE mapping, so the admin dashboard and the main app can
// never show different details for the same application.
// /host-apply submits an APPLICATION — it must go to the parent's hostPortal
// (application/proposal endpoint), never to hostChallengeRequest (which is the
// public enquiry/idea endpoint used by /host-idea).
const HOST_PORTAL_API =
  'https://base44.app/api/apps/69341410f89d26a8fc73a4d1/functions/hostPortal';

/** ChallengeDraft-style application → PartnerInquiry fields. */
export function toPartnerInquiry(p: any) {
  const a = p.answers || {};
  const email = String(a.host_email || a.contact_email || '').toLowerCase();
  const audience = [a.discovery_age, a.discovery_setting].filter(Boolean).join(' · ');
  return {
    company_name: a.organisation_name || a.org_name || a.contact_name || 'Host',
    company_website: a.beneficiary_website || '',
    industry: a.org_kind || '',
    contact_name: a.contact_name || a.name || '',
    contact_email: email,
    contact_phone: a.contact_phone || a.phone || '',
    challenge_title: p.challenge_title || 'Untitled challenge',
    challenge_type: p.category || '',
    challenge_goal: a.primary_objective || '',
    challenge_description: p.challenge_description || p.challenge_title || '',
    audience_description: audience || a.beneficiary_name || 'To be confirmed',
    audience_size: p.participant_range || p.scale_band || '',
    geographic_scope: a.org_state || '',
    launch_timing: p.program_scope || '',
    start_date: a.start_date || '',
    end_date: a.end_date || '',
    prize_format: a.prize_pool || '',
    how_heard: a.template_name ? `Template: ${a.template_name}` : 'Host application wizard',
    additional_notes: [
      `Source: host application wizard (/host-apply)`,
      `Package: ${p.delivery_level || ''}`,
      `Organised for: ${a.beneficiary_for === 'other' ? a.beneficiary_name || 'someone else' : 'their own organisation'}`,
      `Divisions: ${(p.divisions || []).join(', ')}`,
      `Add-ons: ${(p.addons || []).join(', ')}`,
      a.beneficiary_notes ? `Notes: ${a.beneficiary_notes}` : '',
    ].filter(Boolean).join('\n'),
  };
}

export interface PushResult {
  request_id: string;
  invoice_id: string;
  amount: number; // main app's price in DOLLARS (not cents)
  price?: any;    // full price breakdown from the main app
}

/**
 * Sends the application to the parent's hostPortal as a guest_apply — the
 * application/proposal endpoint. Returns the parent's proposal id AND the
 * invoice_id the parent created (needed to confirm payment afterwards).
 * THROWS on any failure, so the caller never reports success for a request the
 * main app has not accepted.
 */
export async function pushHostRequest(p: any): Promise<PushResult> {
  const a = p.answers || {};
  const email = String(a.host_email || a.contact_email || '').toLowerCase().trim();
  const contactName = String(a.contact_name || a.name || '').trim();
  const phone = String(a.contact_phone || a.phone || '').trim();
  // The parent's guest_apply rejects a blank organisation_name with
  // "Please tell us who this challenge is for". Fall back to the contact
  // name, beneficiary, or a generic label so the push never fails on this.
  const orgName = String(
    a.organisation_name || a.org_name || a.contact_name || a.beneficiary_name || 'Individual host'
  ).trim();
  const savedQuoteId = String(a.saved_quote_id || '').trim();

  // Forward the Stripe PaymentIntent that was already charged by the child
  // app, plus the exact amount charged (in cents).  The parent's guest_apply
  // uses these to create an invoice that matches the real Stripe payment —
  // without them the parent prices the invoice with its own rate card, the
  // amounts diverge, and guest_confirm_payment rejects with "Payment amount
  // does not match the invoice".
  const paymentIntentId = String(p.payment_intent_id || '').trim();
  const paymentAmount = Number(p.payment_amount) || 0;

  const payload: Record<string, unknown> = {
    action: 'guest_apply',
    email,
    contact_name: contactName,
    phone,
    organisation_name: orgName,
    answers: a,
  };
  if (savedQuoteId) payload.saved_quote_id = savedQuoteId;
  if (paymentIntentId) payload.payment_intent_id = paymentIntentId;
  if (paymentAmount > 0) payload.payment_amount = paymentAmount;

  let res: Response;
  try {
    res = await fetch(HOST_PORTAL_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    throw new Error(`Could not reach the main 53 Challenges app: ${e.message}`);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || `The main app rejected this application (${res.status}).`);
  }
  const id = String(data?.proposal_id || data?.request_id || data?.id || '');
  if (!id) throw new Error(data?.error || 'The main app did not confirm this application.');
  return {
    request_id: id,
    invoice_id: String(data?.invoice_id || ''),
    amount: Number(data?.amount || 0),
    price: data?.price,
  };
}

/**
 * Tells the parent's hostPortal that Stripe has charged the card, so it can
 * flip its proposal + invoice from unpaid → paid.  Must be called after
 * pushHostRequest succeeds AND the child app's own confirm_payment has
 * verified the PaymentIntent is succeeded.
 *
 * Best-effort: if this fails the host has still paid (the card was charged),
 * so we do NOT throw — the parent admin can reconcile from Stripe.  We log
 * the failure so it surfaces in the function logs.
 */
export async function confirmGuestPayment(params: {
  invoice_id: string;
  payment_intent_id: string;
  email: string;
}): Promise<{ ok: boolean; error?: string }> {
  if (!params.invoice_id || !params.payment_intent_id) {
    return { ok: false, error: 'Missing invoice_id or payment_intent_id' };
  }
  // The main app's guest_apply creates the invoice moments before this is
  // called.  Its database is eventually consistent, so the first attempt can
  // 404 with "Invoice not found" if the invoice hasn't been committed yet.
  // Retry with backoff so a fast payment confirmation still syncs.
  const delays = [0, 1500, 3000];
  let lastError = '';
  for (let attempt = 0; attempt < delays.length; attempt++) {
    if (delays[attempt] > 0) await new Promise((r) => setTimeout(r, delays[attempt]));
    try {
      const res = await fetch(HOST_PORTAL_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'guest_confirm_payment', ...params }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) return { ok: true };
      lastError = data?.error || `HTTP ${res.status}`;
      // Only retry on "Invoice not found" (race condition); other errors are
      // permanent (wrong PI, already confirmed, etc.) so don't waste attempts.
      if (res.status !== 404) break;
    } catch (e) {
      lastError = e.message;
    }
  }
  return { ok: false, error: lastError };
}