import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { toIdeaPayload, ideaApiPost, ideaApiGet, fromIdeaRecord, createEnquiry } from '../../shared/hostIdeas.ts';
import { templatesApiGet, toWizardTemplate } from '../../shared/ideaTemplates.ts';
import { pushRequestToParent } from '../../shared/hostRequestLock.ts';
import { assertEmailVerified } from '../../shared/emailVerification.ts';

const ACTIVITY_LABELS = {
  'art-craft-making': 'Art, craft & making',
  'food-farming-community': 'Food, farming & community',
  'music-dance-performance': 'Music, dance & performance',
  'outdoor-adventure': 'Outdoor & adventure',
  'photography-film-digital': 'Photography, film & digital',
  'writing-ideas-innovation': 'Writing, ideas & innovation',
  not_sure: 'Not sure yet',
};

async function submitIdea(req, body) {
  const name = (body.name || '').trim();
  const email = (body.email || '').trim().toLowerCase();
  const phone = (body.phone || '').trim();
  const title = (body.challenge_title || '').trim();
  const description = (body.challenge_description || '').trim();
  const orgType = (body.org_type || '').trim();
  const activity = (body.activity_type || '').trim();

  if (!name || !title || !description) {
    return Response.json({ error: 'Please fill in your name, challenge title and description.' }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return Response.json({ error: 'Please enter a valid email address.' }, { status: 400 });
  }

  const base44 = createClientFromRequest(req);
  const sr = base44.asServiceRole;

  // The address must be confirmed with an emailed code before we post anything.
  try {
    await assertEmailVerified(base44, email, 'host_application', body.verification_token);
  } catch (verifyErr) {
    return Response.json({ error: verifyErr.message }, { status: 400 });
  }

  // The idea lives in the external Host Ideas API — never in this app's database.
  // The enquiry is created on the parent's hostChallengeRequest endpoint (the
  // public enquiry/idea API per the integration guide §1A).
  const saved = await createEnquiry(toIdeaPayload(body)).catch(() => ({ error: 'network' }));
  if (!saved?.success || !saved?.request_id) {
    return Response.json(
      { error: "Something went wrong on our end — we couldn't save your idea. Please try again in a moment." },
      { status: 500 },
    );
  }
  const draft = { id: saved.request_id };

  const activityLabel = ACTIVITY_LABELS[activity] || 'To be confirmed';

  // Alert admins — email + an in-app notification each.
  try {
    const admins = await sr.entities.User.filter({ role: 'admin' }, '-created_date', 10);
    const summary = `A new challenge idea came in through "Tell us your idea".

From: ${name} (${email}${phone ? `, ${phone}` : ''})
Organisation: ${(body.organisation_name || '').trim() || 'Not given'}
Challenge: ${title}
Kind of activity: ${activityLabel}

Their idea:
${description}

Open the admin dashboard → Host Requests → Idea Submissions to review it.`;
    for (const a of admins || []) {
      await sr.entities.HostNotification.create({
        recipient_email: a.email,
        title: `New challenge idea: ${title}`,
        body: `${name} (${email}) submitted a new idea. Review it under Host Requests → Idea Submissions.`,
        proposal_id: draft.id,
        read: false,
      }).catch(() => null);
      await sr.integrations.Core.SendEmail({
        from_name: '53 Challenges',
        to: a.email,
        subject: `New challenge idea: ${title}`,
        body: summary,
      }).catch(() => null);
    }
  } catch (adminErr) {
    // Never fail the host's submission over an admin alert.
  }
  try {
    await sr.integrations.Core.SendEmail({
      from_name: '53 Challenges',
      to: email,
      subject: "We've received your challenge idea — 53 Challenges",
      body: `Hi ${name},

Thanks for sharing your challenge idea with us — we love hearing what people want to create.

Here's what you sent through:

Challenge: ${title}
Kind of activity: ${activityLabel}
Hosting for: ${orgType || 'Not specified'}

Your idea in your words:
${description}

Our team will read through it and get back to you within 2 business days to arrange a short chat about how we can help bring it to life.

Talk soon,
The 53 Challenges team`,
    });
  } catch (mailErr) {
    // The idea is saved either way — never lose it over an email hiccup.
  }

  return Response.json({ success: true, draft_id: draft.id });
}

// Receives the Host-a-Challenge form data (PartnerInquiry field names),
// calls the external hostChallengeRequest API (which emails the applicant +
// alerts admins), AND saves a local PartnerInquiry record tagged with the
// logged-in user's email so admins can trace it back to the account.
export default async function(req) {
  try {
    const body = await req.json().catch(() => ({}));

    // "Tell us your idea" — public, unauthenticated challenge idea submission.
    if (body.action === 'submit_idea') {
      return await submitIdea(req, body);
    }

    // Signed-in host: their own past ideas, matched on their account email.
    if (body.action === 'my_ideas') {
      const base44 = createClientFromRequest(req);
      const me = await base44.auth.me().catch(() => null);
      const email = (me?.email || '').toLowerCase();
      if (!email) return Response.json({ ideas: [] });
      const res = await ideaApiGet({ action: 'ideas', limit: '200' }).catch(() => ({}));
      const list = Array.isArray(res?.ideas) ? res.ideas : [];
      const mine = list
        .map(fromIdeaRecord)
        .filter((i) => String(i.answers?.email || '').toLowerCase() === email)
        .sort((a, b) => String(b.created_date).localeCompare(String(a.created_date)));
      return Response.json({ ideas: mine });
    }

    // Public: draft a description from the host's working title.
    if (body.action === 'suggest_description') {
      const title = (body.challenge_title || '').trim();
      if (title.length < 3) {
        return Response.json({ error: 'Please add a challenge title first.' }, { status: 400 });
      }
      const base44 = createClientFromRequest(req);
      const activityLabel = ACTIVITY_LABELS[(body.activity_type || '').trim()] || '';
      const text = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: `A person is telling us about a community challenge idea they'd like to host in Australia.

Working title: "${title}"
${activityLabel ? `Kind of activity: ${activityLabel}` : ''}
${body.org_type ? `They are hosting for: ${body.org_type}` : ''}
${body.current_description ? `Their rough notes so far: ${body.current_description}` : ''}

Write a short description of this challenge idea, written in first person as the host (using "we"), in 3 to 4 plain-English sentences. Cover who would take part, what they would actually do, and what would make it special. Warm and simple, no marketing hype, no headings, no bullet points. Return only the description text.`,
      });
      return Response.json({ description: String(text || '').trim() });
    }

    // Public: active challenge templates hosts can start from — served by the
    // external Challenge Idea Templates API (never this app's database).
    if (body.action === 'list_idea_templates') {
      const res = await templatesApiGet({ action: 'templates', status: 'active' }).catch(() => ({}));
      const list = Array.isArray(res?.templates) ? res.templates : [];
      return Response.json({
        templates: list
          .map(toWizardTemplate)
          .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
      });
    }

    const { form_data, logged_in_email } = body;

    if (!form_data) return Response.json({ error: "Missing form_data" }, { status: 400 });

    // Validate required fields
    const required = ['company_name', 'contact_name', 'contact_email', 'challenge_title', 'challenge_description', 'audience_description'];
    const missing = required.filter(k => !form_data[k]?.toString().trim());
    if (missing.length) {
      return Response.json({ error: `Missing required fields: ${missing.join(', ')}` }, { status: 400 });
    }

    // Validate email
    const email = (form_data.contact_email || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return Response.json({ error: "Invalid contact_email" }, { status: 400 });
    }

    // The contact address must be confirmed with an emailed code first.
    {
      const verifyClient = createClientFromRequest(req);
      try {
        await assertEmailVerified(verifyClient, email, 'host_application', body.verification_token);
      } catch (verifyErr) {
        return Response.json({ error: verifyErr.message, needs_verification: true }, { status: 400 });
      }
    }

    // Push the enquiry to the parent's request API — the single source of
    // truth. No local copy is kept, so deletions on the parent are reflected
    // here immediately and there is nothing to fall out of sync.
    let requestId = '';
    try {
      requestId = await pushRequestToParent(form_data);
    } catch (apiErr) {
      return Response.json(
        { error: "We couldn't submit your request right now. Please try again in a moment." },
        { status: 502 },
      );
    }
    if (!requestId) {
      return Response.json(
        { error: "We couldn't confirm your submission with our system. Please try again." },
        { status: 502 },
      );
    }

    return Response.json({ success: true, request_id: requestId });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}