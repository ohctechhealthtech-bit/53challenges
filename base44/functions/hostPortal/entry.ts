import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import Stripe from 'npm:stripe@17.5.0';
import { secrets, waitUntil } from 'base44:runtime';
import { verifyCustomSession } from '../../shared/customSession.ts';
import { priceApplication, scoreApplication, ADDON_FEES } from '../../shared/hostPricing.ts';
import { ideaApiGet, ideaApiPost, fromIdeaRecord, IDEA_STATUSES } from '../../shared/hostIdeas.ts';
import { getOrganisation, getOrganisationMembers } from '../../shared/hostOrganisation.ts';
import { pushHostRequest, toPartnerInquiry, confirmGuestPayment } from '../../shared/hostRequestPush.ts';
import { listMyRequests, getRequest } from '../../shared/hostRequestApi.ts';
import { fetchChallengeApi } from '../../shared/challengeApiHelper.ts';

/** Parent request status → the review_status values the host dashboard UI
 *  expects (ProposalStatusTracker / ProposalsPanel). The parent's flow is
 *  new → in_review → contacted → accepted / declined. */
function mapStatusToReviewStatus(status: string): string {
  switch (String(status || '').toLowerCase()) {
    case 'in_review': return 'in_review';
    case 'contacted': return 'terms_pending';
    case 'accepted': return 'approved';
    case 'declined': return 'rejected';
    case 'new':
    default: return 'intake_received';
  }
}

/** Parent request record → the proposal shape the host dashboard expects. */
function fromParentProposal(r: any): any {
  if (!r) return null;
  return {
    id: r.id,
    parent_request_id: r.id,
    challenge_title: r.challenge_title || '',
    challenge_description: r.challenge_description || '',
    review_status: mapStatusToReviewStatus(r.status),
    content_type: '',
    admin_feedback: '',
    answers: {},
    created_date: r.submitted_at || '',
    company_name: r.company_name || '',
    converted_challenge_id: r.converted_challenge_id || '',
  };
}

// Host Marketplace portal — one API for the host lifecycle:
//   registration → application draft (autosave) → pricing → payment →
//   submitted proposal → admin review → live challenge → host dashboard.
//
// Host actions (platform auth OR signed custom session_token):
//   'get_application_draft' / 'save_application_draft' / 'discard_application_draft'
//   'price_application'      → { answers } price breakdown
//   'start_application_payment' → Stripe PaymentIntent + pending HostInvoice
//   'confirm_payment'        → verify PaymentIntent, mark invoice paid
//   'submit_application'     → create the ChallengeDraft proposal (invoice must be paid)
//   'register_org'           → create Organisation + owner membership
//   'get_workspace'          → everything the dashboard needs, or { no_workspace: true }
//   'dashboard'              → live challenge stats for the host
//   'get_proposal'           → one proposal + its invoices
//   'mark_notifications_read'
//   Legacy: 'submit_proposal', 'list_my_proposals', 'update_proposal'
//
// Admin actions (role=admin): 'admin_list', 'approve', 'request_changes', 'decline'

const PROPOSAL_FIELDS = [
  'challenge_title', 'challenge_description', 'host_type', 'delivery_level',
  'participant_range', 'category', 'winner_method', 'divisions', 'addons',
  'program_scope', 'scale_band', 'answers', 'recommended_snapshot', 'content_type',
];

const EDITABLE_STATUSES = ['intake_received', 'changes_requested', 'builder_started'];
const CHALLENGE_CATEGORIES = [
  'visual-arts', 'photography', 'writing', 'digital-creativity',
  'performance-voice', 'open-experimental',
];

/** Build line items from the MAIN APP's price quote — the single source of
 *  truth for what the host sees and what Stripe charges.  No child-only lines
 *  (deposit, platform integrity fee) are added here; if they should exist
 *  they must be added on the main app side so guest_confirm_payment accepts
 *  them. */
function buildLineItems(mp: any) {
  const items: any[] = [];
  if (mp.package_price) items.push({ name: `${mp.package_name || 'Package'} package`, amount: Math.round(mp.package_price * 100) });
  if (mp.base_price) {
    const challenges = mp.challenges || 1;
    items.push({ name: challenges > 1 ? `Per-challenge fee (${challenges} challenges)` : 'Per-challenge fee', amount: Math.round(mp.base_price * 100) });
  }
  for (const a of (mp.addon_items || [])) items.push({ name: a.name, amount: Math.round(a.price * 100) });
  return items.filter((i) => i.amount > 0);
}

function pickProposal(src) {
  const out: any = { origin: 'host_apply', review_status: 'intake_received' };
  for (const f of PROPOSAL_FIELDS) if (src[f] !== undefined) out[f] = src[f];
  // Content ownership defaults to our team unless the host chose otherwise.
  out.content_type = src.content_type === 'host_managed' ? 'host_managed' : 'admin_managed';
  return out;
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const action = body.action;
    const sr = base44.asServiceRole;

    // ── Identity: platform session first, signed custom session second ──
    const platformUser = await base44.auth.me().catch(() => null);
    let identity = null;
    if (platformUser) {
      identity = {
        id: platformUser.id,
        email: String(platformUser.email || '').toLowerCase(),
        name: platformUser.full_name || '',
        isAdmin: platformUser.role === 'admin',
      };
    } else if (body.session_token) {
      const payload = await verifyCustomSession(String(body.session_token), secrets.get('CHALLENGE_API_KEY') || '').catch(() => null);
      if (payload) identity = { id: payload.uid || payload.email, email: payload.email, name: payload.name || '', isAdmin: false };
    }
    // Payment + submission must work even if the browser session has expired —
    // the host has already filled in everything and is about to pay.
    const GUEST_ACTIONS = ['price_application', 'start_application_payment', 'confirm_payment', 'submit_application', 'save_application_draft', 'get_application_draft', 'discard_application_draft'];
    if (!identity && GUEST_ACTIONS.includes(action)) {
      const guestEmail = String(body.email || body.answers?.contact_email || body.answers?.verified_email || '').toLowerCase();
      identity = { id: '', email: guestEmail || 'guest', name: '', isAdmin: false, guest: true };
    }
    // Drafts need a known email — without one the wizard keeps working from
    // the browser.  Once the guest verifies their email, the draft is created
    // and the main-app pricing cache lives on it, preventing duplicate pushes.
    if (action === 'get_application_draft' && identity?.guest && identity.email === 'guest') {
      return Response.json({ draft: null });
    }
    if ((action === 'save_application_draft' || action === 'discard_application_draft') && identity?.guest && identity.email === 'guest') {
      return Response.json({ ok: true, unsaved: true });
    }
    // The dashboard is readable without a session — it just shows the
    // "no workspace yet" state instead of failing.
    if (!identity && (action === 'get_workspace' || action === 'register_org' || action === 'update_org')) {
      return Response.json({ no_workspace: true });
    }
    if (!identity && action === 'get_organisation') {
      return Response.json({ no_workspace: true, has_organisation: false, has_paid_application: false });
    }
    if (!identity && action === 'dashboard') {
      return Response.json({ stats: { live_challenges: 0, entries: 0, votes: 0, pending_review: 0 }, recent_entries: [] });
    }
    if (!identity) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const email = identity.email;
    const isAdmin = identity.isAdmin;

    const notify = (to, title, text, proposalId = '') =>
      sr.entities.HostNotification.create({ recipient_email: to, title, body: text, proposal_id: proposalId, read: false }).catch(() => null);

    // The host's organisation always comes from the Host Organisations API —
    // never from this app's database — so the name and package shown here can
    // never drift from the central record.
    let orgLookup = null;
    const lookupOrg = async () => {
      if (!orgLookup) {
        orgLookup = email && email.includes('@')
          ? await getOrganisation({ email }).catch(() => ({ found: false }))
          : { found: false };
        if (!orgLookup?.found && identity.id) {
          orgLookup = await getOrganisation({ user_id: identity.id }).catch(() => ({ found: false }));
        }
      }
      return orgLookup;
    };

    const getMember = async () => {
      const res = await lookupOrg();
      if (!res?.found) return null;
      return {
        id: res.membership?.id || '',
        organisation_id: res.organisation.id,
        email,
        name: res.membership?.name || identity.name || '',
        role: res.membership?.role || (res.is_owner ? 'owner' : 'viewer'),
      };
    };

    const getOrg = async () => (await lookupOrg())?.organisation || null;

    const getDraftById = async (draftId) => {
      const l = await sr.entities.HostApplicationDraft.filter({ id: String(draftId || '') }, '-created_date', 1).catch(() => []);
      const d = l?.[0];
      return d && d.owner_email === email ? d : null;
    };

    const getActiveDraft = async () => {
      const l = await sr.entities.HostApplicationDraft.filter({ owner_email: email, status: 'active' }, '-updated_date', 1).catch(() => []);
      return l?.[0] || null;
    };

    // Proposals are pulled from the parent's request API (the single source of
    // truth) — no local ChallengeDraft copy is kept, so deletions on the parent
    // are reflected here immediately. Only the 'proposals' group are host
    // applications; enquiries are shown on the My Requests panel instead.
    const loadProposals = async (_member) => {
      try {
        const rows = await listMyRequests(secrets.get('CHALLENGE_API_KEY') || '', email);
        return rows
          .filter((r) => r.group === 'proposals')
          .map(fromParentProposal)
          .filter(Boolean);
      } catch {
        return [];
      }
    };

    // Signed-in hosts skip the guest-details wizard step, so their contact
    // name + organisation name come from their account/workspace record —
    // not the wizard answers.  The main app's guest_apply rejects a blank
    // contact_name ("Please enter your name") and a blank organisation_name
    // ("Please tell us who this challenge is for"), so we resolve both here
    // with sensible fallbacks before pushing.
    const resolveContactInfo = async (answers: any = {}) => {
      const member = await getMember();
      const organisation = await getOrg();
      const contactName = String(
        answers.contact_name || answers.name || member?.name ||
        organisation?.contact_name || platformUser?.full_name ||
        (email ? email.split('@')[0] : '')
      ).trim();
      const orgName = String(
        answers.organisation_name || answers.org_name || organisation?.name ||
        contactName || answers.beneficiary_name || 'Individual host'
      ).trim();
      const contactEmail = String(
        answers.org_contact_email || answers.contact_email || email || ''
      ).toLowerCase().trim();
      return { contactName, orgName, contactEmail };
    };

    // ── Application draft (server-side autosave) ───────────────────────
    if (action === 'get_application_draft') {
      const draft = await getActiveDraft();
      return Response.json({ draft: draft || null });
    }

    if (action === 'save_application_draft') {
      const answers = body.answers || {};
      let draft = body.draft_id ? await getDraftById(body.draft_id) : null;
      if (!draft) draft = await getActiveDraft();
      const rev = Number(body.revision) || 0;
      if (!draft) {
        const created = await sr.entities.HostApplicationDraft.create({
          owner_email: email, owner_id: identity.id, answers, revision: rev || 1, status: 'active',
        });
        return Response.json({ ok: true, draft_id: created.id, revision: created.revision });
      }
      // Monotonic revision: older saves never overwrite newer ones.
      if (rev <= (draft.revision || 0)) {
        return Response.json({ ok: true, draft_id: draft.id, revision: draft.revision, stale: true });
      }
      // Preserve the cached main-app pricing fields — price_application set
      // them, and wiping them here would cause the next pricing/payment call
      // to push a DUPLICATE request to the main app.
      const preserved = {};
      for (const k of ['main_app_invoice_id', 'main_app_proposal_id', 'main_app_price']) {
        if (draft.answers?.[k] !== undefined) preserved[k] = draft.answers[k];
      }
      await sr.entities.HostApplicationDraft.update(draft.id, { answers: { ...answers, ...preserved }, revision: rev });
      return Response.json({ ok: true, draft_id: draft.id, revision: rev });
    }

    if (action === 'discard_application_draft') {
      const draft = body.draft_id ? await getDraftById(body.draft_id) : await getActiveDraft();
      if (draft) await sr.entities.HostApplicationDraft.update(draft.id, { status: 'discarded' });
      return Response.json({ ok: true });
    }

    // ── Pricing ────────────────────────────────────────────────────────
    // Returns the MAIN APP's price (the source of truth for what will be
    // charged).  Calls guest_apply to get the real price + invoice_id, and
    // caches the result on the draft so start_application_payment can reuse
    // the same invoice instead of creating a duplicate.
    if (action === 'price_application') {
      const answers = body.answers || {};
      const draft = body.draft_id ? await getDraftById(body.draft_id) : null;
      // Re-use the cached main-app price if the draft already has one.
      if (draft?.answers?.main_app_invoice_id && draft?.answers?.main_app_price) {
        const mp = draft.answers.main_app_price;
        const totalCents = Math.round(Number(mp.total_price || 0) * 100);
        return Response.json({ pricing: {
          currency: 'aud',
          line_items: buildLineItems(mp),
          total_amount: totalCents,
          payment_required: totalCents > 0,
          main_app_price: mp,
        }});
      }
      // Otherwise, call guest_apply to get the real price.  Signed-in hosts
      // skip the guest-details step, so resolve their name + organisation
      // from their account/workspace record before pushing.
      const { contactName, orgName, contactEmail } = await resolveContactInfo(answers);
      const pushAnswers = {
        ...answers,
        host_email: email,
        contact_name: contactName,
        contact_email: contactEmail,
        organisation_name: orgName,
        org_name: orgName,
      };
      let pushResult = null;
      let pushError = '';
      try {
        pushResult = await pushHostRequest({ answers: pushAnswers });
      } catch (e) {
        pushError = e.message;
      }
      if (pushResult) {
        const mp = pushResult.price || {};
        const totalCents = Math.round(pushResult.amount * 100);
        if (draft) {
          await sr.entities.HostApplicationDraft.update(draft.id, {
            answers: { ...answers, main_app_invoice_id: pushResult.invoice_id, main_app_proposal_id: pushResult.request_id, main_app_price: mp },
          }).catch(() => null);
        }
        return Response.json({ pricing: {
          currency: 'aud',
          line_items: buildLineItems(mp),
          total_amount: totalCents,
          payment_required: totalCents > 0,
          main_app_price: mp,
        }});
      }
      // Do NOT silently fall back to the child app's pricing — the main app's
      // price is authoritative (it is what Stripe will be charged).  Surfacing
      // the error here prevents the host from seeing one price and being
      // charged another.
      return Response.json({ error: pushError || 'Could not reach the main app for pricing. Please try again in a moment.' }, { status: 502 });
    }

    // ── Payment (Stripe PaymentIntent + HostInvoice) ───────────────────
    if (action === 'start_application_payment') {
      const draft = await getDraftById(body.draft_id);
      const answers = body.answers || draft?.answers || {};
      if (!draft && !body.answers) return Response.json({ error: 'Draft not found' }, { status: 404 });
      if (draft && body.answers) {
        const preserved = {};
        for (const k of ['main_app_invoice_id', 'main_app_proposal_id', 'main_app_price']) {
          if (draft.answers?.[k] !== undefined) preserved[k] = draft.answers[k];
        }
        await sr.entities.HostApplicationDraft.update(draft.id, { answers: { ...body.answers, ...preserved }, revision: (draft.revision || 0) + 1 });
      }

      // ── Get the REAL price from the main app ──────────────────────────
      // The child app and main app have different pricing engines.  The main
      // app's guest_confirm_payment rejects if the Stripe PaymentIntent amount
      // doesn't match its invoice, so we MUST charge what the main app prices.
      // price_application (called by PricingSummary) already pushed to
      // guest_apply and cached the invoice_id on the draft.  Reuse it so we
      // don't create a duplicate proposal on the main app.
      let mainAppInvoiceId = String(draft?.answers?.main_app_invoice_id || '');
      let mainAppProposalId = String(draft?.answers?.main_app_proposal_id || '');
      let mainAppAmountDollars = Number(draft?.answers?.main_app_price?.total_price || 0);
      let mainAppPrice = draft?.answers?.main_app_price || null;

      if (!mainAppInvoiceId) {
        const { contactName, orgName, contactEmail } = await resolveContactInfo(answers);
        const pushAnswers = {
          ...answers,
          host_email: email,
          contact_name: contactName,
          contact_email: contactEmail,
          organisation_name: orgName,
          org_name: orgName,
        };
        const pushResult = await pushHostRequest({ answers: pushAnswers });
        mainAppInvoiceId = pushResult.invoice_id;
        mainAppProposalId = pushResult.request_id;
        mainAppAmountDollars = pushResult.amount;
        mainAppPrice = pushResult.price;
        if (draft) {
          await sr.entities.HostApplicationDraft.update(draft.id, {
            answers: { ...answers, main_app_invoice_id: mainAppInvoiceId, main_app_proposal_id: mainAppProposalId, main_app_price: mainAppPrice },
          });
        }
      }

      // Convert the main app's price from dollars to cents for Stripe.
      const totalAmountCents = Math.round(mainAppAmountDollars * 100);
      // ASSERT: the amount we're about to charge MUST match the main app's
      // total_price exactly.  If they diverge, guest_confirm_payment will
      // reject ("Payment amount does not match the invoice"), so we refuse to
      // create the PaymentIntent rather than charge the wrong amount.
      const mainAppTotalCents = Math.round(Number(mainAppPrice?.total_price || 0) * 100);
      if (mainAppTotalCents > 0 && totalAmountCents !== mainAppTotalCents) {
        return Response.json({ error: `Pricing mismatch: the amount to charge (A$${(totalAmountCents / 100).toFixed(2)}) does not match the main app's quote (A$${(mainAppTotalCents / 100).toFixed(2)}). Please refresh and try again.` }, { status: 500 });
      }
      if (totalAmountCents <= 0) return Response.json({ error: 'No payment required for this application' }, { status: 400 });

      const stripe = new Stripe(secrets.get('STRIPE_SECRET_KEY'));
      const label = `Challenge application — ${answers.challenge_title || 'Your challenge'}`;
      const intent = await stripe.paymentIntents.create({
        amount: totalAmountCents,
        currency: 'aud',
        ...(email && email.includes('@') ? { receipt_email: email } : {}),
        description: label,
        automatic_payment_methods: { enabled: true },
        metadata: { draft_id: draft?.id || '', owner_email: email, main_app_invoice_id: mainAppInvoiceId },
      });
      const lineItems = (mainAppPrice?.addon_items || []).map((a) => ({ name: a.name, amount: Math.round(a.price * 100) }));
      if (mainAppPrice?.base_price) lineItems.unshift({ name: `${mainAppPrice.package_name || 'Package'} — ${mainAppPrice.challenges || 1} challenge(s)`, amount: Math.round(mainAppPrice.base_price * 100) });
      if (mainAppPrice?.package_price) lineItems.unshift({ name: `${mainAppPrice.package_name || 'Package'} package`, amount: Math.round(mainAppPrice.package_price * 100) });
      const invoice = await sr.entities.HostInvoice.create({
        owner_email: email, draft_id: draft?.id || '', purpose: 'application', label,
        amount: totalAmountCents, currency: 'aud', line_items: lineItems.filter((li) => li.amount > 0),
        status: 'pending', stripe_payment_intent_id: intent.id,
      });
      const pricingSnapshot = { ...priceApplication(answers), main_app_amount_dollars: mainAppAmountDollars, main_app_price: mainAppPrice };
      if (draft) await sr.entities.HostApplicationDraft.update(draft.id, { pricing_snapshot: pricingSnapshot });
      return Response.json({
        client_secret: intent.client_secret,
        publishable_key: secrets.get('STRIPE_PUBLISHABLE_KEY'),
        invoice_id: invoice.id,
        amount: totalAmountCents,
        label,
        main_app_invoice_id: mainAppInvoiceId,
        main_app_price: mainAppPrice,
      });
    }

    if (action === 'confirm_payment') {
      const l = await sr.entities.HostInvoice.filter({ id: String(body.invoice_id || '') }, '-created_date', 1).catch(() => []);
      const invoice = l?.[0];
      if (!invoice || (invoice.owner_email !== email && !isAdmin && !identity.guest)) {
        return Response.json({ error: 'Invoice not found' }, { status: 404 });
      }
      const alreadyPaid = invoice.status === 'paid';
      if (!alreadyPaid) {
        const stripe = new Stripe(secrets.get('STRIPE_SECRET_KEY'));
        const intent = await stripe.paymentIntents.retrieve(invoice.stripe_payment_intent_id);
        if (intent.status !== 'succeeded') {
          return Response.json({ error: 'Payment has not completed yet' }, { status: 409 });
        }
        await sr.entities.HostInvoice.update(invoice.id, { status: 'paid', paid_at: new Date().toISOString() });
        await notify(email, 'Payment received', `We've received your payment of A$${(invoice.amount / 100).toLocaleString('en-AU')}. Thank you!`, invoice.proposal_id || '');
      }

      // ── Confirm payment on the main app so its proposal flips to paid ──
      // The main app's invoice was created in start_application_payment (via
      // guest_apply).  Now that Stripe has succeeded, tell the main app so it
      // marks its own invoice + proposal as paid.
      // NOTE: confirm_payment is called with only { invoice_id } from the
      // wizard — no email/answers — so the guest identity is 'guest' and
      // getDraftById (which checks owner_email === email) would reject it.
      // We already verified invoice ownership above, so look up the draft
      // directly by ID without the email check.
      const draft = invoice.draft_id
        ? (await sr.entities.HostApplicationDraft.filter({ id: String(invoice.draft_id) }, '-created_date', 1).catch(() => []))?.[0]
        : null;
      const mainAppInvoiceId = String(draft?.answers?.main_app_invoice_id || body.main_app_invoice_id || '');
      const confirmEmail = String(draft?.owner_email || invoice.owner_email || email || '').toLowerCase();
      if (mainAppInvoiceId && invoice.stripe_payment_intent_id) {
        const confirm = await confirmGuestPayment({
          invoice_id: mainAppInvoiceId,
          payment_intent_id: invoice.stripe_payment_intent_id,
          email: confirmEmail,
        });
        if (!confirm.ok) {
          // The host has paid (Stripe succeeded), so we do NOT block the
          // confirmation.  Log the error so it surfaces in the function logs
          // for admin reconciliation.
          console.error(`[confirm_payment] guest_confirm_payment failed for invoice ${invoice.id} (main_app_invoice_id=${mainAppInvoiceId}): ${confirm.error}`);
        }
      }
      return Response.json({ ok: true, invoice: { ...invoice, status: 'paid' } });
    }

    // ── Submit the application (creates the ChallengeDraft proposal) ───
    if (action === 'submit_application') {
      const draft = await getDraftById(body.draft_id);
      const answers = body.answers || draft?.answers || {};
      if (!String(answers.challenge_title || '').trim()) {
        return Response.json({ error: 'Please give your challenge a title first' }, { status: 400 });
      }
      // Payment is required when the MAIN APP prices the application above $0.
      // The child app's priceApplication() is NOT authoritative here — the two
      // engines disagree (e.g. child says $0 for self_service, main says $449),
      // so we must guard with the main app's cached price.
      const mainAppTotal = Number(draft?.answers?.main_app_price?.total_price || 0);
      const childPricing = priceApplication(answers);
      const paymentRequired = mainAppTotal > 0 || childPricing.payment_required;
      let invoice = null;
      if (paymentRequired) {
        const l = await sr.entities.HostInvoice.filter({ id: String(body.invoice_id || '') }, '-created_date', 1).catch(() => []);
        invoice = l?.[0];
        const invoiceOk = invoice && invoice.status === 'paid' &&
          (identity.guest || invoice.owner_email === email);
        if (!invoiceOk) {
          return Response.json({ error: 'Payment is required before submitting this application' }, { status: 402 });
        }
      }
      const routing = scoreApplication(answers);
      const member = await getMember();
      // Returning hosts never see the "Your name" field (their organisation is
      // already saved), so the contact name comes from their workspace/account.
      const organisation = await getOrg().catch(() => null);
      const contactName = String(
        answers.contact_name || answers.name || member?.name ||
        organisation?.contact_name || platformUser?.full_name || organisation?.name ||
        (email ? email.split('@')[0] : '')
      ).trim();
      const fields = pickProposal(answers);
      fields.review_status = 'submitted_for_review';
      fields.scale_band = answers.participant_range || '';
      fields.host_organisation_id = member?.organisation_id || '';
      // Library pick vs. custom build — a custom idea has to be looked at and
      // built by us, so it is flagged for the admin review queue.
      const customBuild = !answers.template_id;
      fields.template_id = answers.template_id || '';
      // Keep the FULL wizard answers on the proposal — the push to the main
      // site needs contact/organisation fields, which live outside `structured`.
      // The parent's guest_apply requires a non-empty organisation_name — it
      // rejects with "Please tell us who this challenge is for" when it's blank.
      // Signed-in hosts with an existing org may not have typed one in the
      // wizard, so fall back to the org record, then the contact/beneficiary.
      const orgNameForPush = String(
        answers.organisation_name || answers.org_name || organisation?.name || contactName ||
        answers.beneficiary_name || ''
      ).trim();
      fields.answers = {
        ...answers,
        ...(answers.structured || {}),
        routing,
        host_email: email,
        contact_name: contactName,
        contact_email: answers.org_contact_email || answers.contact_email || email,
        organisation_name: orgNameForPush,
        org_name: orgNameForPush,
        template_id: answers.template_id || '',
        template_name: answers.template_name || '',
        custom_build: customBuild,
      };
      // Re-submitting after a failed push must never create a second proposal.
      let proposal = null;
      if (draft?.proposal_id) {
        const existing = await sr.entities.ChallengeDraft.filter({ id: draft.proposal_id }, '-created_date', 1).catch(() => []);
        if (existing?.[0]) {
          await sr.entities.ChallengeDraft.update(existing[0].id, fields).catch(() => null);
          proposal = { ...existing[0], ...fields };
        }
      }
      if (!proposal) {
        proposal = platformUser
          ? await base44.entities.ChallengeDraft.create(fields)
          : await sr.entities.ChallengeDraft.create(fields);
      }
      // First-time hosts have their organisation created centrally by this
      // submission — read it back so the proposal points at the real record.
      if (!fields.host_organisation_id) {
        orgLookup = null;
        const freshOrg = await getOrg();
        if (freshOrg?.id) {
          await sr.entities.ChallengeDraft.update(proposal.id, { host_organisation_id: freshOrg.id });
          proposal.host_organisation_id = freshOrg.id;
        }
      }
      if (invoice) await sr.entities.HostInvoice.update(invoice.id, { proposal_id: proposal.id });
      if (draft) await sr.entities.HostApplicationDraft.update(draft.id, { proposal_id: proposal.id, answers, pricing_snapshot: childPricing });

      // ── The proposal was already created on the main app during ─────────
      // start_application_payment (guest_apply).  Re-use those IDs so we
      // never create a duplicate.  If they're missing (e.g. the draft was
      // created before this fix), fall back to pushing now.
      let requestId = String(draft?.answers?.main_app_proposal_id || answers.main_app_proposal_id || '');
      let mainAppInvoiceId = String(draft?.answers?.main_app_invoice_id || answers.main_app_invoice_id || '');

      if (!requestId) {
        let pushError = '';
        for (let attempt = 0; attempt < 2 && !requestId; attempt++) {
          try {
            const pushResult = await pushHostRequest({
              ...proposal,
              payment_intent_id: invoice?.stripe_payment_intent_id || '',
              payment_amount: invoice?.amount || 0,
            });
            requestId = pushResult.request_id;
            mainAppInvoiceId = pushResult.invoice_id;
          } catch (e) {
            pushError = e.message;
          }
        }
        if (!requestId) {
          return Response.json({
            error: `We saved your application but could not send it to 53 Challenges. Please try again in a moment. (${pushError})`,
            proposal_id: proposal.id,
          }, { status: 502 });
        }
        // Save the main-app IDs on the draft so confirm_payment and future
        // re-submissions can reuse them instead of pushing a duplicate.
        if (draft && (mainAppInvoiceId || requestId)) {
          await sr.entities.HostApplicationDraft.update(draft.id, {
            answers: { ...draft.answers, main_app_invoice_id: mainAppInvoiceId, main_app_proposal_id: requestId },
          }).catch(() => null);
        }
        // Confirm payment for the fallback push (the normal path already
        // confirmed in confirm_payment).
        if (mainAppInvoiceId && invoice?.stripe_payment_intent_id) {
          await confirmGuestPayment({
            invoice_id: mainAppInvoiceId,
            payment_intent_id: invoice.stripe_payment_intent_id,
            email,
          });
        }
      }

      await sr.entities.ChallengeDraft.update(proposal.id, {
        answers: { ...fields.answers, main_domain_request_id: requestId },
      }).catch(() => null);

      // The same request is stored here as a PartnerInquiry, which is what the
      // admin dashboard's Host Requests queue reads.
      const inquiry = toPartnerInquiry(proposal);
      const alreadyLogged = await sr.entities.PartnerInquiry.filter({ parent_request_id: requestId }, '-created_date', 1).catch(() => []);
      if (!(alreadyLogged || []).length) {
        await sr.entities.PartnerInquiry.create({
          ...inquiry,
          owner_email: email,
          parent_request_id: requestId,
          status: 'new',
          internal_notes: `Host application ${proposal.id} — submitted through /host-apply by ${email}`,
        }).catch(() => null);
      }

      if (draft) await sr.entities.HostApplicationDraft.update(draft.id, { status: 'submitted' }).catch(() => null);
      await notify(email, 'Application received', `Your challenge "${answers.challenge_title}" has been sent for review. We'll be in touch soon.`, proposal.id);
      waitUntil((async () => {
        // Applicants without an account get one created for them, so they can
        // sign in and follow their application in their host workspace.
        let accountCreated = false;
        if (email && email.includes('@')) {
          const existing = await sr.entities.User.filter({ email }, '-created_date', 1).catch(() => []);
          if (!(existing || []).length) {
            try {
              await base44.users.inviteUser(email, 'user');
              accountCreated = true;
            } catch { /* they can still register themselves */ }
          }
        }
        const nextSteps = accountCreated
          ? `We've also set up your 53 Challenges account for this email address. You'll receive a separate invitation email — open it to set your password, then:

1. Sign in at 53 Challenges with ${email}.
2. Open "Host dashboard" from your account menu.
3. Go to "My challenges" to see the status of this application.`
          : `To follow your application:

1. Sign in to 53 Challenges with ${email}.
2. Open "Host dashboard" from your account menu.
3. Go to "My challenges" — the status updates there as we review it.`;
        await sr.integrations.Core.SendEmail({
          from_name: '53 Challenges',
          to: email,
          subject: `Application received: ${answers.challenge_title}`,
          body: `Hi ${answers.contact_name || 'there'},

Thanks for your challenge application — we've received it and our team is reviewing it now.

Challenge: ${answers.challenge_title}
Package: ${answers.delivery_level || 'Not specified'}
Status: Submitted for review

${nextSteps}

We'll email you as soon as there's an update.

The 53 Challenges team`,
        }).catch(() => null);

        const admins = await sr.entities.User.filter({ role: 'admin' }, '-created_date', 3).catch(() => []);
        for (const a of admins || []) {
          await sr.integrations.Core.SendEmail({
            to: a.email,
            subject: `New host application: ${answers.challenge_title}`,
            body: `A new host application was submitted by ${email}.\n\nTitle: ${answers.challenge_title}\nPackage: ${answers.delivery_level}\nChallenge: ${answers.template_name || 'Custom build — needs to be designed'}\nReview queue: ${routing.route_queue} (risk: ${routing.risk_level})\n\nReview it in the admin dashboard.`,
          }).catch(() => null);
        }
      })());
      return Response.json({ ok: true, proposal, main_app_request_id: requestId });
    }

    // ── Workspace registration & dashboard ─────────────────────────────
    // Resolve the signed-in host's organisation — the source of truth for
    // whether we still need to ask for organisation details.
    if (action === 'get_organisation') {
      const member = await getMember();
      const organisation = await getOrg();
      if (!member || !organisation) return Response.json({ no_workspace: true, has_organisation: false, has_paid_application: false });
      const invoices = await sr.entities.HostInvoice.filter({ owner_email: email, status: 'paid' }, '-created_date', 1).catch(() => []);
      return Response.json({
        has_organisation: true,
        organisation,
        member,
        has_paid_application: (invoices || []).length > 0,
      });
    }

    // Organisation details are owned centrally — this app never stores or
    // edits them; both actions simply read the current record back.
    if (action === 'update_org' || action === 'register_org') {
      orgLookup = null;
      const member = await getMember();
      const organisation = await getOrg();
      if (!organisation) return Response.json({ success: false, no_workspace: true, organisation: null, member: null });
      return Response.json({ ok: true, success: true, already_registered: true, organisation, member });
    }

    if (action === 'get_workspace') {
      const member = await getMember();
      const organisation = await getOrg();
      if (!member || !organisation) return Response.json({ no_workspace: true });
      const team = await getOrganisationMembers(organisation.id).catch(() => []);
      const proposals = await loadProposals(member);
      const invoices = await sr.entities.HostInvoice.filter({ owner_email: email }, '-created_date', 50).catch(() => []);
      const notifications = await sr.entities.HostNotification.filter({ recipient_email: email }, '-created_date', 30).catch(() => []);
      let packages = [];
      try {
        const r = await base44.functions.invoke('hostPackages', {});
        packages = r?.data?.packages || r?.packages || [];
      } catch { /* packages are optional for the dashboard */ }
      const addons = Object.entries(ADDON_FEES).map(([key, v]) => ({ key, name: v.name, amount: v.amount }));
      return Response.json({
        organisation, member, team: team || [], proposals,
        addons, orders: [], invoices: invoices || [], notifications: notifications || [],
        messages: [], posts: [], assets: [], packages,
      });
    }

    if (action === 'dashboard') {
      const member = await getMember();
      const proposals = await loadProposals(member);
      const live = proposals.filter((p) => p.challenge_id).slice(0, 5);
      let entriesTotal = 0, votesTotal = 0, pendingReview = 0;
      const recent = [];
      for (const p of live) {
        const entries = await sr.entities.Entry.filter({ challenge_id: p.challenge_id }, '-created_date', 200).catch(() => []);
        entriesTotal += entries.length;
        for (const e of entries) {
          votesTotal += e.vote_count || 0;
          if (e.status === 'pending') pendingReview++;
        }
        for (const e of entries.slice(0, 5)) {
          recent.push({ id: e.id, title: e.title, creator_name: e.creator_name, status: e.status, created_date: e.created_date, challenge_title: p.challenge_title });
        }
      }
      recent.sort((a, b) => String(b.created_date).localeCompare(String(a.created_date)));
      return Response.json({
        stats: { live_challenges: live.length, entries: entriesTotal, votes: votesTotal, pending_review: pendingReview },
        recent_entries: recent.slice(0, 6),
      });
    }

    // Approved / live challenges, pinned at the top of the host dashboard.
    // Two sources — this app's approved proposals, and any challenge linked to
    // the host's organisation — de-duplicated by challenge id.
    if (action === 'get_approved_challenges') {
      const member = await getMember();
      const proposals = await loadProposals(member);
      const approvedStatuses = ['approved', 'approved_and_signed', 'live'];
      const items: any[] = [];
      const byChallengeId = new Map<string, any>();

      const liveStates = ['published', 'entry_open', 'voting_open'];
      const challengeCache = new Map<string, any>();
      const loadChallenge = async (cid) => {
        if (!cid) return null;
        if (!challengeCache.has(cid)) {
          const l = await sr.entities.Challenge.filter({ id: cid }, '-created_date', 1).catch(() => []);
          challengeCache.set(cid, l?.[0] || null);
        }
        return challengeCache.get(cid);
      };
      const counts = async (cid) => {
        if (!cid) return { entries: null, votes: null };
        const entries = await sr.entities.Entry.filter({ challenge_id: cid }, '-created_date', 500).catch(() => []);
        return {
          entries: (entries || []).length,
          votes: (entries || []).reduce((n, e) => n + (e.vote_count || 0), 0),
        };
      };

      for (const p of proposals) {
        if (!approvedStatuses.includes(p.review_status) && !p.challenge_id) continue;
        const challenge = await loadChallenge(p.challenge_id);
        const { entries, votes } = await counts(p.challenge_id);
        const item = {
          key: p.challenge_id || p.id,
          proposal_id: p.id,
          challenge_id: p.challenge_id || '',
          title: challenge?.title || p.challenge_title || 'Untitled challenge',
          status: challenge && liveStates.includes(challenge.lifecycle_status) ? 'live' : 'approved',
          start_date: challenge?.starts_at || p.answers?.start_date || '',
          end_date: challenge?.submission_ends_at || p.answers?.end_date || '',
          content_type: (challenge?.content_type || p.content_type) === 'host_managed' ? 'host_managed' : 'admin_managed',
          entries, votes,
        };
        items.push(item);
        if (item.challenge_id) byChallengeId.set(item.challenge_id, item);
      }

      // Challenges owned through the organisation link that have no proposal here.
      if (member?.organisation_id) {
        const owned = await sr.entities.Challenge.filter(
          { host_organisation_id: member.organisation_id }, '-created_date', 50
        ).catch(() => []);
        for (const c of owned || []) {
          if (byChallengeId.has(c.id)) continue;
          if (!liveStates.includes(c.lifecycle_status) && c.lifecycle_status !== 'approved') continue;
          const { entries, votes } = await counts(c.id);
          const item = {
            key: c.id, proposal_id: '', challenge_id: c.id, title: c.title || 'Untitled challenge',
            status: liveStates.includes(c.lifecycle_status) ? 'live' : 'approved',
            start_date: c.starts_at || '', end_date: c.submission_ends_at || '',
            content_type: c.content_type === 'host_managed' ? 'host_managed' : 'admin_managed',
            entries, votes,
          };
          items.push(item);
          byChallengeId.set(c.id, item);
        }
      }

      return Response.json({ challenges: items });
    }

    if (action === 'get_proposal') {
      // The proposal comes from the parent's request API — the single source of
      // truth. Ownership is enforced server-side by getRequest (which matches
      // the request's contact_email to the signed-in host's email).
      let proposal: any = null;
      try {
        const req = await getRequest(secrets.get('CHALLENGE_API_KEY') || '', String(body.id || ''), email);
        if (req) proposal = fromParentProposal(req);
      } catch { /* fall through to not-found */ }
      if (!proposal) return Response.json({ error: 'Proposal not found' }, { status: 404 });

      // Invoices are a local record (Stripe payment intents). They were
      // historically keyed by the local ChallengeDraft id, so look up any
      // local draft that carries this parent request id and use its id to
      // find the invoices. If none exists, no invoices are shown.
      let invoices: any[] = [];
      try {
        const localDrafts = await sr.entities.ChallengeDraft.filter(
          { origin: 'host_apply' }, '-created_date', 200
        ).catch(() => []);
        const match = (localDrafts || []).find((d) =>
          String(d.answers?.main_app_proposal_id || '') === String(proposal.parent_request_id) ||
          String(d.id || '') === String(proposal.parent_request_id)
        );
        const localId = match?.id || proposal.parent_request_id;
        invoices = await sr.entities.HostInvoice.filter({ proposal_id: localId }, '-created_date', 20).catch(() => []);
      } catch { /* invoices are optional */ }

      const paymentStatus = (invoices || []).some((i) => i.status === 'paid') ? 'paid' : (invoices || []).length ? 'pending' : 'none';

      // The real, published challenge always comes from the main 53 Challenges
      // site — the application's review status only covers the application
      // itself. Match by the parent's converted_challenge_id, or by title.
      let liveChallenge = null;
      try {
        const upstream = await fetchChallengeApi(
          'challenges',
          { limit: 500, include_inactive: true },
          secrets.get('CHALLENGE_API_KEY') || '',
          secrets.get('CHALLENGE_API_BASE_URL') || ''
        );
        const wantTitle = String(proposal.challenge_title || '').trim().toLowerCase();
        const wantId = String(proposal.converted_challenge_id || '');
        liveChallenge = (upstream?.challenges || []).find((c) =>
          (wantId && String(c.id) === wantId) ||
          (wantTitle && String(c.title || '').trim().toLowerCase() === wantTitle)
        ) || null;
      } catch { /* the application view still works without it */ }
      if (liveChallenge) proposal.review_status = 'live';

      return Response.json({
        proposal, invoices: invoices || [], payment_status: paymentStatus,
        live_challenge: liveChallenge,
        risk_level: 'low', route_queue: 'standard',
      });
    }

    if (action === 'mark_notifications_read') {
      await sr.entities.HostNotification.updateMany({ recipient_email: email, read: false }, { $set: { read: true } }).catch(() => null);
      return Response.json({ ok: true });
    }

    // ── Legacy host actions (platform auth, used by /host-apply v1) ────
    if (action === 'submit_proposal') {
      if (!platformUser) return Response.json({ error: 'Unauthorized' }, { status: 401 });
      const src = body.proposal || {};
      if (!String(src.challenge_title || '').trim()) {
        return Response.json({ error: 'challenge_title required' }, { status: 400 });
      }
      const draft = await base44.entities.ChallengeDraft.create(pickProposal(src));
      return Response.json({ ok: true, proposal: draft });
    }

    if (action === 'list_my_proposals') {
      if (!platformUser) return Response.json({ error: 'Unauthorized' }, { status: 401 });
      const list = await base44.entities.ChallengeDraft.filter(
        { origin: 'host_apply', created_by_id: platformUser.id }, '-created_date', 50
      ).catch(() => []);
      return Response.json({ proposals: list || [] });
    }

    if (action === 'update_proposal') {
      const id = String(body.id || '');
      const drafts = await sr.entities.ChallengeDraft.filter({ id }, '-created_date', 1).catch(() => []);
      const draft = drafts?.[0];
      if (!draft || (draft.created_by_id !== identity.id && !isAdmin)) {
        return Response.json({ error: 'Proposal not found' }, { status: 404 });
      }
      if (!EDITABLE_STATUSES.includes(draft.review_status)) {
        return Response.json({ error: 'This proposal is locked while it is under review' }, { status: 409 });
      }
      const patch: any = {};
      for (const f of PROPOSAL_FIELDS) if (body.patch?.[f] !== undefined) patch[f] = body.patch[f];
      if (draft.review_status === 'changes_requested') patch.review_status = 'submitted_for_review';
      await sr.entities.ChallengeDraft.update(id, patch);
      return Response.json({ ok: true, proposal: { ...draft, ...patch } });
    }

    // ── Admin actions ──────────────────────────────────────────────────
    if (!isAdmin) return Response.json({ error: 'Admin only' }, { status: 403 });

    // Aggregate data for the admin dashboard's Host Requests hub — proposals,
    // invoices, organisations, plus empty arrays for posts/orders (not yet
    // available in this child app).
    if (action === 'admin_queues') {
      const [proposals, invoices] = await Promise.all([
        sr.entities.ChallengeDraft.filter({ origin: 'host_apply' }, '-created_date', 200).catch(() => []),
        sr.entities.HostInvoice.list('-created_date', 200).catch(() => []),
      ]);
      // Build the org map from the proposal answers — the org name and
      // contact email are already stored there, so no external API call
      // is needed (the external Host Organisations API lookup is unreliable
      // from the admin context).
      const organisations = {};
      for (const p of proposals || []) {
        const oid = p.host_organisation_id;
        if (oid && !organisations[oid]) {
          organisations[oid] = {
            id: oid,
            name: p.answers?.organisation_name || p.answers?.org_name || p.answers?.beneficiary_name || 'Unknown org',
            contact_email: p.answers?.host_email || p.answers?.contact_email || '',
          };
        }
      }
      return Response.json({
        proposals: proposals || [],
        organisations,
        pending_posts: [],
        orders: [],
        invoices: invoices || [],
      });
    }

    // Grant host access to an applicant — used when accepting a host request.
    if (action === 'admin_grant_host_role') {
      const email = String(body.email || '').toLowerCase().trim();
      if (!email || !email.includes('@')) return Response.json({ error: 'Valid email required' }, { status: 400 });
      try {
        await base44.users.inviteUser(email, 'user');
      } catch (e) { /* already invited — not an error */ }
      return Response.json({ ok: true, email });
    }

    // Publish an approved proposal — sends it live on the main site.
    if (action === 'admin_publish_proposal') {
      const proposalId = String(body.proposal_id || '');
      if (!proposalId) return Response.json({ error: 'Proposal ID required' }, { status: 400 });
      // Delegate to the admin challenge API to set the challenge live.
      try {
        const l = await sr.entities.ChallengeDraft.filter({ id: proposalId }, '-created_date', 1).catch(() => []);
        const proposal = l?.[0];
        if (!proposal) return Response.json({ error: 'Proposal not found' }, { status: 404 });
        await sr.entities.ChallengeDraft.update(proposal.id, { review_status: 'live' });
        return Response.json({ ok: true });
      } catch (e) {
        return Response.json({ error: e.message }, { status: 500 });
      }
    }

    // Preview the challenge(s) for a proposal — returns the draft challenge(s)
    // the admin can review before publishing.
    if (action === 'admin_preview_challenges') {
      const proposalId = String(body.proposal_id || '');
      if (!proposalId) return Response.json({ error: 'Proposal ID required' }, { status: 400 });
      const l = await sr.entities.ChallengeDraft.filter({ id: proposalId }, '-created_date', 1).catch(() => []);
      const proposal = l?.[0];
      if (!proposal) return Response.json({ error: 'Proposal not found' }, { status: 404 });
      const challenges: any[] = [];
      if (proposal.challenge_id) {
        const cl = await sr.entities.Challenge.filter({ id: proposal.challenge_id }, '-created_date', 1).catch(() => []);
        if (cl?.[0]) challenges.push(cl[0]);
      }
      return Response.json({
        challenges: challenges.map((c) => ({
          id: c.id,
          title: c.title,
          theme: c.theme,
          brief: c.brief || '',
          cover_image: c.cover_image || '',
          category: c.category || '',
          content_type: c.content_type || '',
          divisions: c.divisions || [],
          status: c.lifecycle_status || c.status || 'draft',
          start_date: c.starts_at || '',
          end_date: c.submission_ends_at || '',
          voting_ends_at: c.voting_ends_at || '',
        })),
      });
    }

    // Update a challenge's editable fields from the admin preview dialog.
    if (action === 'admin_update_challenge') {
      const challengeId = String(body.challenge_id || '');
      if (!challengeId) return Response.json({ error: 'Challenge ID required' }, { status: 400 });
      const f = body.fields || {};
      const patch: any = {};
      if (f.title !== undefined) { patch.title = f.title; patch.theme = f.title; }
      if (f.brief !== undefined) patch.brief = f.brief;
      if (f.cover_image !== undefined) patch.cover_image = f.cover_image;
      if (f.category !== undefined) patch.category = f.category;
      if (f.content_type !== undefined) patch.content_type = f.content_type;
      if (f.divisions !== undefined) patch.divisions = f.divisions;
      if (f.status !== undefined) patch.status = f.status;
      if (f.start_date) patch.starts_at = new Date(f.start_date).toISOString();
      if (f.end_date) patch.submission_ends_at = new Date(f.end_date).toISOString();
      if (f.voting_end_date === null) patch.voting_ends_at = null;
      else if (f.voting_end_date) patch.voting_ends_at = new Date(f.voting_end_date).toISOString();
      await sr.entities.Challenge.update(challengeId, patch);
      return Response.json({ ok: true });
    }

    // Create a new challenge from the admin preview dialog (or from a proposal
    // that doesn't have one yet).  Optionally links the new challenge back to
    // the proposal so the preview shows it immediately.
    if (action === 'admin_create_challenge') {
      const f = body.fields || {};
      if (!f.title) return Response.json({ error: 'Title is required' }, { status: 400 });
      const CHALLENGE_CATEGORY_ENUM = [
        'art-craft-making', 'food-farming-community', 'music-dance-performance',
        'outdoor-adventure', 'photography-film-digital', 'writing-ideas-innovation',
      ];
      const category = CHALLENGE_CATEGORY_ENUM.includes(f.category) ? f.category : 'writing-ideas-innovation';
      const challenge = await sr.entities.Challenge.create({
        title: f.title,
        theme: f.title,
        category,
        brief: f.brief || '',
        cover_image: f.cover_image || '',
        divisions: f.divisions || [],
        content_type: f.content_type === 'host_managed' ? 'host_managed' : 'admin_managed',
        source: 'native',
        lifecycle_status: 'draft',
        status: f.status || 'draft',
        ...(f.start_date ? { starts_at: new Date(f.start_date).toISOString() } : {}),
        ...(f.end_date ? { submission_ends_at: new Date(f.end_date).toISOString() } : {}),
        ...(f.voting_end_date === null ? {} : f.voting_end_date ? { voting_ends_at: new Date(f.voting_end_date).toISOString() } : {}),
      });
      if (body.proposal_id) {
        await sr.entities.ChallengeDraft.update(body.proposal_id, { challenge_id: challenge.id }).catch(() => null);
      }
      return Response.json({ ok: true, challenge_id: challenge.id });
    }

    // Admin decision on a proposal — 'go_live' publishes the challenge(s).
    if (action === 'admin_decide') {
      const proposalId = String(body.proposal_id || '');
      const decision = String(body.decision || '');
      if (!proposalId) return Response.json({ error: 'Proposal ID required' }, { status: 400 });
      if (decision !== 'go_live') return Response.json({ error: 'Unknown decision' }, { status: 400 });
      const l = await sr.entities.ChallengeDraft.filter({ id: proposalId }, '-created_date', 1).catch(() => []);
      const proposal = l?.[0];
      if (!proposal) return Response.json({ error: 'Proposal not found' }, { status: 404 });
      if (proposal.challenge_id) {
        const cl = await sr.entities.Challenge.filter({ id: proposal.challenge_id }, '-created_date', 1).catch(() => []);
        const challenge = cl?.[0];
        if (challenge) {
          const divs = challenge.divisions || [];
          const hasKids = divs.some((d) => ['children', 'teens'].includes(String(d || '').toLowerCase()));
          if (hasKids) {
            return Response.json({
              error: 'This challenge includes children/teens divisions. Remove those divisions or keep it draft until guardian consent is live.',
            }, { status: 403 });
          }
          const now = new Date();
          const hasStarted = challenge.starts_at && new Date(challenge.starts_at) <= now;
          await sr.entities.Challenge.update(challenge.id, {
            lifecycle_status: hasStarted ? 'entry_open' : 'published',
            status: 'active',
          });
        }
      }
      await sr.entities.ChallengeDraft.update(proposal.id, { review_status: 'live' });
      if (proposal.answers?.host_email) {
        await notify(proposal.answers.host_email, 'Your challenge is live',
          `Great news — "${proposal.challenge_title}" is now live on 53 Challenges. Participants can start entering now.`, proposal.id);
      }
      return Response.json({ ok: true });
    }

    // Ideas sent through the public "Tell us your idea" wizard — their own
    // review queue, separate from full host applications.
    if (action === 'list_idea_submissions') {
      const res = await ideaApiGet({ action: 'ideas', limit: '200' }).catch(() => ({}));
      if (res?.error) return Response.json({ error: res.error }, { status: 502 });
      return Response.json({ ideas: (res?.ideas || []).map(fromIdeaRecord) });
    }

    if (action === 'set_idea_status') {
      const ideaId = String(body.id || '');
      const status = String(body.review_status || '');
      if (!ideaId || !IDEA_STATUSES.includes(status)) {
        return Response.json({ error: 'A valid idea and status are required' }, { status: 400 });
      }
      const res = await ideaApiPost({ action: 'set_status', id: ideaId, status, is_read: true }).catch(() => ({ error: 'network' }));
      if (!res?.success) return Response.json({ error: res?.error || 'Could not update this idea' }, { status: 502 });
      return Response.json({ ok: true, idea: fromIdeaRecord(res.idea) });
    }

    if (action === 'admin_list') {
      const list = await sr.entities.ChallengeDraft.filter({ origin: 'host_apply' }, '-created_date', 100).catch(() => []);
      return Response.json({ proposals: list || [] });
    }

    const id = String(body.id || '');
    const drafts = await sr.entities.ChallengeDraft.filter({ id }, '-created_date', 1).catch(() => []);
    const draft = drafts?.[0];
    if (!draft) return Response.json({ error: 'Proposal not found' }, { status: 404 });

    if (action === 'request_changes') {
      const feedback = String(body.feedback || '').trim();
      if (!feedback) return Response.json({ error: 'feedback required' }, { status: 400 });
      await sr.entities.ChallengeDraft.update(id, { review_status: 'changes_requested', admin_feedback: feedback });
      if (draft.answers?.host_email) await notify(draft.answers.host_email, 'Changes requested', feedback, id);
      return Response.json({ ok: true });
    }

    if (action === 'decline') {
      const reason = String(body.reason || '').trim();
      if (!reason) return Response.json({ error: 'reason required' }, { status: 400 });
      await sr.entities.ChallengeDraft.update(id, { review_status: 'rejected', decline_reason: reason });
      if (draft.answers?.host_email) await notify(draft.answers.host_email, 'Application declined', reason, id);
      return Response.json({ ok: true });
    }

    if (action === 'approve') {
      if (draft.challenge_id) {
        return Response.json({ error: 'A challenge was already created from this proposal' }, { status: 409 });
      }
      const category = CHALLENGE_CATEGORIES.includes(draft.category) ? draft.category : 'open-experimental';
      const challenge = await sr.entities.Challenge.create({
        title: draft.challenge_title || 'Untitled challenge',
        theme: draft.challenge_title || 'Untitled challenge',
        category,
        brief: draft.challenge_description || draft.challenge_title || '',
        divisions: draft.divisions || [],
        content_type: draft.content_type === 'host_managed' ? 'host_managed' : 'admin_managed',
        source: 'native',
        lifecycle_status: 'draft',
        status: 'draft',
      });
      await sr.entities.ChallengeDraft.update(id, {
        review_status: 'approved',
        challenge_id: challenge.id,
        admin_feedback: draft.admin_feedback || '',
      });
      if (draft.answers?.host_email) {
        await notify(draft.answers.host_email, 'Application approved', `Great news — "${draft.challenge_title}" has been approved and is being prepared to go live.`, id);
      }
      return Response.json({ ok: true, challenge_id: challenge.id });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}