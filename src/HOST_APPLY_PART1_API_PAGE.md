# /host-apply — Part 1: API Reference & Page

This is part 1 of the complete /host-apply code reference. See also:
- `HOST_APPLY_PART2_WIZARD.md` — Wizard model, screen router, shell & progress
- `HOST_APPLY_PART3_STEPS.md` — All step components
- `HOST_APPLY_PART4_SUPPORT.md` — Supporting components, hooks, shared logic, entities

---

## API Reference — hostPortal backend function

**File:** `base44/functions/hostPortal/entry.ts`
**Endpoint:** `https://fifty-three-quest.base44.app/functions/hostPortal`
**Method:** POST
**Auth:** Platform session (cookie) OR `session_token` (signed custom session) OR guest (for payment/submission actions)

### Actions

| Action | Auth | Payload | Returns |
|--------|------|---------|---------|
| `get_application_draft` | session | — | `{ draft }` |
| `save_application_draft` | session | `{ draft_id?, answers, revision }` | `{ ok, draft_id, revision }` |
| `discard_application_draft` | session | `{ draft_id? }` | `{ ok }` |
| `price_application` | guest ok | `{ answers }` | `{ pricing }` |
| `start_application_payment` | guest ok | `{ draft_id, answers }` | `{ client_secret, publishable_key, invoice_id, amount, label }` |
| `confirm_payment` | guest ok | `{ invoice_id }` | `{ ok, invoice }` |
| `submit_application` | guest ok | `{ draft_id, answers, invoice_id? }` | `{ ok, proposal, main_app_request_id }` |
| `get_organisation` | session | — | `{ has_organisation, organisation, member, has_paid_application }` |
| `register_org` | session | `{ name, kind, contact_email, state, abn }` | `{ ok, organisation, member }` |
| `get_workspace` | session | — | `{ organisation, member, team, proposals, invoices, notifications, packages }` |
| `dashboard` | session | — | `{ stats, recent_entries }` |
| `get_proposal` | session | `{ id }` | `{ proposal, invoices, payment_status, live_challenge }` |
| `mark_notifications_read` | session | — | `{ ok }` |
| `admin_list` | admin | — | `{ proposals }` |
| `approve` | admin | `{ id }` | `{ ok, challenge_id }` |
| `request_changes` | admin | `{ id, feedback }` | `{ ok }` |
| `decline` | admin | `{ id, reason }` | `{ ok }` |

### Architecture Overview

```
Browser (/host-apply)
  │
  ├── HostApplication.jsx          ← wizard page (one question per screen)
  │     ├── useApplicationDraft()   ← autosave to server
  │     ├── useHostOrganisation()   ← lookup saved org
  │     ├── buildScreens()          ← dynamic screen list from answers
  │     └── ApplyScreenBody          ← routes screen key → step component
  │
  ├── hostPortalClient.js          ← thin wrapper over base44.functions.invoke
  │     └── hostPortal(action, payload)
  │
  └── base44/functions/hostPortal/entry.ts   ← THE API
        ├── Identity: platform session OR signed custom session OR guest
        ├── Draft autosave (get/save/discard)
        ├── Pricing (priceApplication)
        ├── Stripe payment (start_application_payment → confirm_payment)
        ├── Submission (submit_application → pushHostRequest → PartnerInquiry)
        ├── Workspace (get_organisation, get_workspace, dashboard)
        └── Admin (admin_list, approve, request_changes, decline)
```

### Data flow

1. **Draft autosave** — every answer change is debounced (800ms) and saved server-side with a monotonic revision number.
2. **Pricing** — `price_application` returns a live breakdown from `hostPricing.ts`.
3. **Email verification** — OTP code sent via `emailVerification` function; verified before payment.
4. **Payment** — `start_application_payment` creates a Stripe PaymentIntent + HostInvoice; the browser confirms via Stripe Elements; `confirm_payment` marks the invoice paid.
5. **Submission** — `submit_application` creates a `ChallengeDraft` proposal, pushes to the main 53 site (`pushHostRequest`), logs a `PartnerInquiry`, invites the user, and emails confirmations.

### Full source — base44/functions/hostPortal/entry.ts

```typescript
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import Stripe from 'npm:stripe@17.5.0';
import { secrets, waitUntil } from 'base44:runtime';
import { verifyCustomSession } from '../../shared/customSession.ts';
import { priceApplication, scoreApplication, ADDON_FEES } from '../../shared/hostPricing.ts';
import { ideaApiGet, ideaApiPost, fromIdeaRecord, IDEA_STATUSES } from '../../shared/hostIdeas.ts';
import { getOrganisation, getOrganisationMembers } from '../../shared/hostOrganisation.ts';
import { pushHostRequest, toPartnerInquiry } from '../../shared/hostRequestPush.ts';
import { fetchChallengeApi } from '../../shared/challengeApiHelper.ts';

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

function pickProposal(src) {
  const out: any = { origin: 'host_apply', review_status: 'intake_received' };
  for (const f of PROPOSAL_FIELDS) if (src[f] !== undefined) out[f] = src[f];
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
    const GUEST_ACTIONS = ['price_application', 'start_application_payment', 'confirm_payment', 'submit_application'];
    if (!identity && GUEST_ACTIONS.includes(action)) {
      const guestEmail = String(body.email || body.answers?.contact_email || '').toLowerCase();
      identity = { id: '', email: guestEmail || 'guest', name: '', isAdmin: false, guest: true };
    }
    if (!identity && action === 'get_application_draft') return Response.json({ draft: null });
    if (!identity && (action === 'save_application_draft' || action === 'discard_application_draft')) {
      return Response.json({ ok: true, unsaved: true });
    }
    if (!identity && action === 'get_workspace') return Response.json({ no_workspace: true });
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

    const loadProposals = async (member) => {
      let proposals = [];
      if (member) {
        proposals = await sr.entities.ChallengeDraft.filter(
          { origin: 'host_apply', host_organisation_id: member.organisation_id }, '-created_date', 50
        ).catch(() => []);
      }
      if (platformUser) {
        const own = await sr.entities.ChallengeDraft.filter(
          { origin: 'host_apply', created_by_id: platformUser.id }, '-created_date', 50
        ).catch(() => []);
        const seen = new Set(proposals.map((p) => p.id));
        for (const p of own || []) if (!seen.has(p.id)) proposals.push(p);
      }
      return proposals;
    };

    // ── Application draft (server-side autosave) ──
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
      if (rev <= (draft.revision || 0)) {
        return Response.json({ ok: true, draft_id: draft.id, revision: draft.revision, stale: true });
      }
      await sr.entities.HostApplicationDraft.update(draft.id, { answers, revision: rev });
      return Response.json({ ok: true, draft_id: draft.id, revision: rev });
    }

    if (action === 'discard_application_draft') {
      const draft = body.draft_id ? await getDraftById(body.draft_id) : await getActiveDraft();
      if (draft) await sr.entities.HostApplicationDraft.update(draft.id, { status: 'discarded' });
      return Response.json({ ok: true });
    }

    // ── Pricing ──
    if (action === 'price_application') {
      return Response.json({ pricing: priceApplication(body.answers || {}) });
    }

    // ── Payment (Stripe PaymentIntent + HostInvoice) ──
    if (action === 'start_application_payment') {
      const draft = await getDraftById(body.draft_id);
      const answers = body.answers || draft?.answers || {};
      if (!draft && !body.answers) return Response.json({ error: 'Draft not found' }, { status: 404 });
      if (draft && body.answers) await sr.entities.HostApplicationDraft.update(draft.id, { answers, revision: (draft.revision || 0) + 1 });
      const pricing = priceApplication(answers);
      if (!pricing.payment_required) return Response.json({ error: 'No payment required for this application' }, { status: 400 });

      const stripe = new Stripe(secrets.get('STRIPE_SECRET_KEY'));
      const label = `Challenge application — ${answers.challenge_title || 'Your challenge'}`;
      const intent = await stripe.paymentIntents.create({
        amount: pricing.total_amount,
        currency: 'aud',
        ...(email && email.includes('@') ? { receipt_email: email } : {}),
        description: label,
        automatic_payment_methods: { enabled: true },
        metadata: { draft_id: draft?.id || '', owner_email: email },
      });
      const lineItems = [
        { name: pricing.package.label, amount: pricing.package.amount },
        ...pricing.addons.map((a) => ({ name: a.name, amount: a.amount })),
      ].filter((li) => li.amount > 0);
      const invoice = await sr.entities.HostInvoice.create({
        owner_email: email, draft_id: draft?.id || '', purpose: 'application', label,
        amount: pricing.total_amount, currency: 'aud', line_items: lineItems,
        status: 'pending', stripe_payment_intent_id: intent.id,
      });
      if (draft) await sr.entities.HostApplicationDraft.update(draft.id, { pricing_snapshot: pricing });
      return Response.json({
        client_secret: intent.client_secret,
        publishable_key: secrets.get('STRIPE_PUBLISHABLE_KEY'),
        invoice_id: invoice.id,
        amount: pricing.total_amount,
        label,
      });
    }

    if (action === 'confirm_payment') {
      const l = await sr.entities.HostInvoice.filter({ id: String(body.invoice_id || '') }, '-created_date', 1).catch(() => []);
      const invoice = l?.[0];
      if (!invoice || (invoice.owner_email !== email && !isAdmin && !identity.guest)) {
        return Response.json({ error: 'Invoice not found' }, { status: 404 });
      }
      if (invoice.status === 'paid') return Response.json({ ok: true, invoice });
      const stripe = new Stripe(secrets.get('STRIPE_SECRET_KEY'));
      const intent = await stripe.paymentIntents.retrieve(invoice.stripe_payment_intent_id);
      if (intent.status !== 'succeeded') {
        return Response.json({ error: 'Payment has not completed yet' }, { status: 409 });
      }
      await sr.entities.HostInvoice.update(invoice.id, { status: 'paid', paid_at: new Date().toISOString() });
      await notify(email, 'Payment received', `We've received your payment of A$${(invoice.amount / 100).toLocaleString('en-AU')}. Thank you!`, invoice.proposal_id || '');
      return Response.json({ ok: true, invoice: { ...invoice, status: 'paid' } });
    }

    // ── Submit the application (creates the ChallengeDraft proposal) ──
    if (action === 'submit_application') {
      const draft = await getDraftById(body.draft_id);
      const answers = body.answers || draft?.answers || {};
      if (!String(answers.challenge_title || '').trim()) {
        return Response.json({ error: 'Please give your challenge a title first' }, { status: 400 });
      }
      const pricing = priceApplication(answers);
      let invoice = null;
      if (pricing.payment_required) {
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
      const customBuild = !answers.template_id;
      fields.template_id = answers.template_id || '';
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
      if (!fields.host_organisation_id) {
        orgLookup = null;
        const freshOrg = await getOrg();
        if (freshOrg?.id) {
          await sr.entities.ChallengeDraft.update(proposal.id, { host_organisation_id: freshOrg.id });
          proposal.host_organisation_id = freshOrg.id;
        }
      }
      if (invoice) await sr.entities.HostInvoice.update(invoice.id, { proposal_id: proposal.id });
      if (draft) await sr.entities.HostApplicationDraft.update(draft.id, { proposal_id: proposal.id, answers, pricing_snapshot: pricing });

      let requestId = '';
      let pushError = '';
      for (let attempt = 0; attempt < 2 && !requestId; attempt++) {
        try {
          requestId = await pushHostRequest(proposal);
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
      await sr.entities.ChallengeDraft.update(proposal.id, {
        answers: { ...fields.answers, main_domain_request_id: requestId },
      }).catch(() => null);

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

    // ── Workspace registration & dashboard ──
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
      const l = await sr.entities.ChallengeDraft.filter({ id: String(body.id || '') }, '-created_date', 1).catch(() => []);
      const proposal = l?.[0];
      const member = await getMember();
      const owns = proposal && (
        isAdmin ||
        (platformUser && proposal.created_by_id === platformUser.id) ||
        (member && proposal.host_organisation_id === member.organisation_id) ||
        proposal.answers?.host_email === email
      );
      if (!owns) return Response.json({ error: 'Proposal not found' }, { status: 404 });
      const invoices = await sr.entities.HostInvoice.filter({ proposal_id: proposal.id }, '-created_date', 20).catch(() => []);
      const routing = proposal.answers?.routing || {};
      const paymentStatus = (invoices || []).some((i) => i.status === 'paid') ? 'paid' : (invoices || []).length ? 'pending' : 'none';
      let liveChallenge = null;
      try {
        const upstream = await fetchChallengeApi(
          'challenges',
          { limit: 500, include_inactive: true },
          secrets.get('CHALLENGE_API_KEY') || '',
          secrets.get('CHALLENGE_API_BASE_URL') || ''
        );
        const wantTitle = String(proposal.challenge_title || '').trim().toLowerCase();
        liveChallenge = (upstream?.challenges || []).find((c) =>
          (proposal.challenge_id && String(c.id) === String(proposal.challenge_id)) ||
          (wantTitle && String(c.title || '').trim().toLowerCase() === wantTitle)
        ) || null;
      } catch { /* the application view still works without it */ }
      if (liveChallenge && proposal.review_status !== 'live') {
        const patch: any = { review_status: 'live' };
        if (!proposal.challenge_id) patch.challenge_id = String(liveChallenge.id);
        await sr.entities.ChallengeDraft.update(proposal.id, patch).catch(() => null);
        Object.assign(proposal, patch);
      }
      return Response.json({
        proposal, invoices: invoices || [], payment_status: paymentStatus,
        live_challenge: liveChallenge,
        risk_level: routing.risk_level || 'low', route_queue: routing.route_queue || 'standard',
      });
    }

    if (action === 'mark_notifications_read') {
      await sr.entities.HostNotification.updateMany({ recipient_email: email, read: false }, { $set: { read: true } }).catch(() => null);
      return Response.json({ ok: true });
    }

    // ── Legacy host actions ──
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

    // ── Admin actions ──
    if (!isAdmin) return Response.json({ error: 'Admin only' }, { status: 403 });

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
```

---

## Page — HostApplication.jsx

**File:** `src/pages/host/HostApplication.jsx`

```jsx
/**
 * /host-apply — one-question-per-screen host application wizard.
 *
 * Screens come from buildScreens() (src/lib/applyWizardModel.js), so the total
 * is always calculated from the answers so far. Validation runs per screen via
 * validateQuestion() and shows a red panel that scrolls into view. Answers
 * autosave to a server-side draft. Signed-in hosts finish on Payment; visitors
 * finish on "Your details", which creates the account and takes payment.
 */
import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import WizardShell from '@/components/host/WizardShell';
import WizardProgress from '@/components/host/apply/WizardProgress';
import WizardErrorPanel from '@/components/host/apply/WizardErrorPanel';
import ApplyScreenBody from '@/components/host/apply/ApplyScreenBody';
import OnboardingChecklist from '@/components/host/OnboardingChecklist';
import useCategoryPickSteps from '@/components/host/apply/CategoryPickFlow';
import DraftSavedNote from '@/components/host/DraftSavedNote';
import usePackageOptions from '@/components/host/usePackageOptions';
import useApplicationDraft from '@/components/host/apply/useApplicationDraft';
import ApplicationSubmitted from '@/components/host/apply/ApplicationSubmitted';
import useCategoryOptions from '@/components/host/useCategoryOptions';
import useHostOrganisation from '@/components/host/apply/useHostOrganisation';
import { hostPortal } from '@/lib/hostPortalClient';
import { judgesMaster } from '@/lib/judgesMaster';
import { pricingCalculator } from '@/lib/pricingCalculator';
import { quoteToApplyAnswers } from '@/lib/quoteToApplyAnswers';
import {
  buildScreens, validateQuestion, divisionsForAudience, isSeriesScope, usesJudgePanel,
} from '@/lib/applyWizardModel';
import { getWizardDefaults, participantCount, toStructuredAnswers } from '@/lib/hostWizardDefaults';
import { useAuth } from '@/lib/AuthContext';

const PACKAGE_KEYS = ['self_service', 'supported', 'fully_managed'];

const BLANK_ANSWERS = {
  host_type: 'business',
  delivery_level: 'supported',
  challenge_title: '',
  challenge_description: '',
  template_id: '',
  template_name: '',
  custom_challenge_idea: false,
  accepted_entry_types: [],
  discovery_format: '',
  discovery_age: '',
  discovery_setting: '',
  participant_range: '50_250',
  start_date: '',
  end_date: '',
  category: '',
  content_type: '',
  winner_method: 'combination',
  judging_policy_accepted: false,
  org_name: '',
  org_kind: 'business',
  org_contact_email: '',
  contact_name: '',
  contact_email: '',
  contact_phone: '',
  organisation_name: '',
  org_state: '',
  org_abn: '',
  beneficiary_for: '',
  beneficiary_name: '',
  beneficiary_contact_name: '',
  beneficiary_contact_email: '',
  beneficiary_contact_role: '',
  beneficiary_contact_phone: '',
  beneficiary_website: '',
  beneficiary_notes: '',
  divisions: [],
  judge_source: 'platform',
  host_judges: [],
  selected_judge_ids: [],
  host_judge_ids: [],
  program_scope: '',
  series_count: '',
  series_cadence: '',
  addons: [],
  email_verified: false,
  verified_email: '',
};

export default function HostApplication({ embedded = false }) {
  const { isAuthenticated, isLoadingAuth, user } = useAuth();
  const { search } = useLocation();
  const urlParams = new URLSearchParams(search);
  const urlPackage = urlParams.get('package');
  const quoteId = urlParams.get('quote_id') || '';
  const preselected = PACKAGE_KEYS.includes(urlPackage) ? urlPackage : null;
  const packageOptions = usePackageOptions();
  const { options: categoryOptions } = useCategoryOptions();
  const { organisation, reload: reloadOrg } = useHostOrganisation();
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState([]);
  const { answers, setAnswers, draftId, loaded, savedAt } = useApplicationDraft(
    preselected ? { ...BLANK_ANSWERS, delivery_level: preselected } : BLANK_ANSWERS
  );

  useEffect(() => {
    if (!preselected || !loaded) return;
    setAnswers((a) => ({ ...a, delivery_level: preselected }));
  }, [preselected, loaded, setAnswers]);

  useEffect(() => {
    if (!quoteId || !loaded) return;
    pricingCalculator.getSavedQuote(quoteId).then((res) => {
      if (!res?.saved_quote) return;
      setAnswers((a) => (a.saved_quote_id === quoteId ? a : { ...a, ...quoteToApplyAnswers(res.saved_quote) }));
    }).catch(() => {});
  }, [quoteId, loaded, setAnswers]);

  const defaults = useMemo(
    () => getWizardDefaults(answers.host_type, answers.delivery_level, participantCount(answers.participant_range)),
    [answers.host_type, answers.delivery_level, answers.participant_range]
  );

  const set = (k, v) => setAnswers((a) => ({ ...a, [k]: v }));

  const setScope = (v) => {
    const clearing = isSeriesScope(answers.program_scope) && !isSeriesScope(v) &&
      (answers.series_count || answers.series_cadence);
    if (clearing && !window.confirm('Switching back to a one-off clears how many challenges you chose and how often they run. Continue?')) return;
    setAnswers((a) => ({
      ...a,
      program_scope: v,
      ...(isSeriesScope(v) ? {} : { series_count: '', series_cadence: '' }),
    }));
  };

  const series = isSeriesScope(answers.program_scope);
  const divisions = divisionsForAudience(answers.discovery_age);
  const panel = usesJudgePanel(answers.winner_method);
  const needsHostDetails = isAuthenticated && !organisation;
  const verifyEmail = isAuthenticated ? (user?.email || '') : (answers.contact_email || '').trim().toLowerCase();

  const resolvedAnswers = {
    ...answers,
    divisions: divisions.length ? divisions : defaults.divisions,
    addons: answers.addons.length ? answers.addons : defaults.addons,
    series_count: series ? Number(answers.series_count) || 0 : 0,
    series_cadence: series ? answers.series_cadence : '',
    content_type: answers.content_type || 'admin_managed',
    scale_band: answers.participant_range,
    judge_source: panel ? (answers.judge_source || 'platform') : 'platform',
    host_judges: panel
      ? (answers.host_judges || []).filter((j) => (j.name || '').trim() && (j.email || '').includes('@'))
      : [],
    selected_judge_ids: panel ? (answers.selected_judge_ids || []) : [],
    host_judge_ids: panel ? (answers.host_judges || []).map((j) => j.id).filter(Boolean) : [],
    judge_ids: panel
      ? [...(answers.selected_judge_ids || []), ...(answers.host_judges || []).map((j) => j.id).filter(Boolean)]
      : [],
    org_name: answers.org_name || answers.organisation_name,
    contact_email: answers.contact_email || answers.org_contact_email,
    structured: toStructuredAnswers({
      ...answers,
      divisions: divisions.length ? divisions : defaults.divisions,
    }),
    recommended_snapshot: defaults,
  };

  const discovery = useCategoryPickSteps({ answers, set, setAnswers });
  const discoveryBodies = {
    challenge_kind: discovery[0].body,
    activity_format: discovery[1].body,
    audience: discovery[2].body,
    setting: discovery[3].body,
    template: discovery[4].body,
  };

  const screens = buildScreens(answers, { packagePreselected: !!preselected, isAuthenticated });
  const safeStep = Math.min(step, screens.length - 1);
  const current = screens[safeStep];

  useEffect(() => { setErrors([]); }, [answers, safeStep]);

  useEffect(() => {
    if (answers.email_verified && answers.verified_email && answers.verified_email !== verifyEmail) {
      setAnswers((a) => ({ ...a, email_verified: false, verified_email: '' }));
    }
  }, [verifyEmail]);

  const runScreenSideEffects = async (key) => {
    if (key === 'host_type' && !organisation && isAuthenticated) {
      await hostPortal('register_org', {
        name: answers.org_name,
        kind: answers.org_kind,
        contact_email: answers.org_contact_email,
        state: answers.org_state,
        abn: answers.org_abn,
      });
      await reloadOrg();
      return;
    }
    if (key === 'judges' && isAuthenticated) {
      const rows = answers.host_judges || [];
      const pending = rows.filter((j) => !j.id && (j.name || '').trim() && (j.email || '').includes('@'));
      if (!pending.length) return;
      const res = await judgesMaster.saveHostJudges(pending);
      const byEmail = {};
      for (const s of res.judges || []) byEmail[(s.email || '').toLowerCase()] = s.id;
      set('host_judges', rows.map((j) => (j.id ? j : { ...j, id: byEmail[(j.email || '').toLowerCase()] || '' })));
    }
  };

  const goNext = async () => {
    const found = validateQuestion(current.key, answers, { needsHostDetails, isAuthenticated });
    if (found.length) { setErrors(found); return; }
    setErrors([]);
    setBusy(true);
    try {
      await runScreenSideEffects(current.key);
      setStep(safeStep + 1);
    } finally {
      setBusy(false);
    }
  };

  if (!loaded) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center py-10">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const Wrapper = embedded ? 'div' : 'main';
  const inner = embedded ? '' : 'container-tight';
  const guestCanSubmit = validateQuestion('guest_submit', answers, {}).length === 0;

  return (
    <Wrapper className={embedded ? 'host-light rounded-2xl border border-border p-6 sm:p-8' : 'host-light py-10 sm:py-14'}>
      {submitted ? (
        <div className={`${inner} mx-auto max-w-3xl`}>
          <ApplicationSubmitted title={answers.challenge_title} />
        </div>
      ) : (
        <>
          <div className={`${inner} mb-8 max-w-3xl`}>
            <h1 className="font-heading text-3xl font-extrabold sm:text-4xl">Host a challenge</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Answer a few simple questions and we'll take it from there. Your progress saves automatically.
            </p>
            <div className="mt-6">
              <OnboardingChecklist currentStep={1} />
            </div>
          </div>

          <div className={inner}>
            <WizardShell
              stepIndex={safeStep}
              totalSteps={screens.length}
              question={current.question}
              hint={current.hint}
              onBack={safeStep > 0 ? () => { setErrors([]); setStep(safeStep - 1); } : null}
              onNext={goNext}
              submitting={busy}
              nextLabel={current.nextLabel || 'Continue'}
              hideNext={current.hideNext}
              progress={<WizardProgress phase={current.phase} stepIndex={safeStep} totalSteps={screens.length} />}
              errorPanel={<WizardErrorPanel errors={errors} />}
              footerNote={<DraftSavedNote savedAt={savedAt} />}
            >
              <ApplyScreenBody
                screenKey={current.key}
                answers={answers}
                set={set}
                setScope={setScope}
                defaults={defaults}
                packageOptions={packageOptions}
                categoryOptions={categoryOptions}
                organisation={organisation}
                discoveryBodies={discoveryBodies}
                draftId={draftId}
                resolvedAnswers={resolvedAnswers}
                onSubmitted={() => setSubmitted(true)}
                isAuthenticated={isAuthenticated}
                isLoadingAuth={isLoadingAuth}
                guestCanSubmit={guestCanSubmit}
                errors={errors}
                verifyEmail={verifyEmail}
                onAdvance={goNext}
              />
            </WizardShell>
          </div>
        </>
      )}
    </Wrapper>
  );
}
```

---

## Client — hostPortalClient.js

**File:** `src/lib/hostPortalClient.js`

```javascript
// Single client helper for the hostPortal backend:
// hostPortal(action, payload) → response data (throws on error).
// Every call carries the signed session_token so the backend can resolve
// the user even without a platform session.
import { base44 } from '@/api/base44Client';
import { getSessionToken } from '@/lib/appSession';
import { functionErrorMessage } from '@/lib/functionErrors';

export async function hostPortal(action, payload = {}) {
  let res;
  try {
    res = await base44.functions.invoke('hostPortal', {
      action,
      session_token: getSessionToken(),
      ...payload,
    });
  } catch (err) {
    throw new Error(functionErrorMessage(err));
  }
  const data = res?.data || {};
  if (data.error) throw new Error(data.error);
  return data;
}
```

---

*End of Part 1. Continue to Part 2 for the wizard model, screen router, and shell components.*