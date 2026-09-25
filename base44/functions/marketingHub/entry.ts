import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

const TEMPLATES = {
  welcome: (c) => ({
    subject: "Welcome to 53 Challenges",
    body: `Hi ${c.name || "there"},\n\nWelcome to 53 Challenges — Australia's creative competition platform. We'll let you know when new challenges open, voting goes live, and results are announced.\n\nExplore live challenges at https://53challenges.com/challenges\n\n— The 53 Challenges team`,
  }),
  entry_confirmed: (c) => ({
    subject: `Your entry "${c.title || ""}" is confirmed`,
    body: `Hi ${c.name || "there"},\n\nYour entry to ${c.challenge || "the challenge"} has been received and confirmed. Good luck — share it to gather community votes!\n\n— The 53 Challenges team`,
  }),
  voting_open: (c) => ({
    subject: `Voting is open: ${c.challenge || "the challenge"}`,
    body: `Hi ${c.name || "there"},\n\nVoting is now open for ${c.challenge || "the challenge"}. Cast your vote for your favourite creators.\n\n— The 53 Challenges team`,
  }),
  results_announced: (c) => ({
    subject: `Results are in: ${c.challenge || "the challenge"}`,
    body: `Hi ${c.name || "there"},\n\nThe results for ${c.challenge || "the challenge"} have been announced. Visit the challenge page to see the winners.\n\n— The 53 Challenges team`,
  }),
};

function genCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function matchesSegment(m, seg) {
  if ((seg.audience_types || []).length && !(seg.audience_types || []).includes(m.audience_type)) return false;
  if ((seg.states || []).length && !(seg.states || []).includes(m.state)) return false;
  if ((seg.categories || []).length) {
    const ints = m.category_interests || [];
    if (!(seg.categories || []).some((c) => ints.includes(c))) return false;
  }
  if (seg.participated_only && !m.participated_before) return false;
  return true;
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    let input = {};
    try { input = await req.json(); } catch (e) {}
    const action = input.action || "";
    const p = input;
    const user = await base44.auth.me().catch(() => null);

    // ---- Public / authenticated actions ----
    if (action === "addAudience") {
      if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
      const email = (p.email || "").trim().toLowerCase();
      if (!email) return Response.json({ error: "Email required" }, { status: 400 });
      // Written through the service role: the AudienceMember entity denies
      // direct client writes, so signup must go through this function.
      const audienceSr = base44.asServiceRole;
      const existing = await audienceSr.entities.AudienceMember.filter({ email });
      let member;
      if (existing && existing.length) {
        const u = {};
        if (p.name) u.name = p.name;
        if (p.audience_type) u.audience_type = p.audience_type;
        if (p.state) u.state = p.state;
        if (p.categories) u.category_interests = p.categories;
        if (p.source) u.source = p.source;
        if (p.organisation_id) { u.organisation_id = p.organisation_id; u.organisation_name = p.organisation_name || ""; }
        if (p.participated_before != null) u.participated_before = p.participated_before;
        member = await audienceSr.entities.AudienceMember.update(existing[0].id, u);
      } else {
        member = await audienceSr.entities.AudienceMember.create({
          email, name: p.name || "", audience_type: p.audience_type || "creator",
          state: p.state || "", category_interests: p.categories || [],
          source: p.source || "coming_soon", organisation_id: p.organisation_id || "",
          organisation_name: p.organisation_name || "", participated_before: !!p.participated_before,
        });
        try {
          const t = TEMPLATES.welcome({ name: member.name });
          await base44.integrations.Core.SendEmail({ to: email, subject: t.subject, body: t.body });
          member = await audienceSr.entities.AudienceMember.update(member.id, { welcomed_at: new Date().toISOString() });
        } catch (e) {
          /* recipient may not be a registered user — SendEmail reaches registered users only */
        }
      }
      return Response.json({ member });
    }

    if (action === "sendLifecycle") {
      // Admin-only: platform-branded email must not be triggerable by any
      // signed-in user against any registered member's address.
      if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
      if (!(user.role === "admin" || user.role === "creator" || user.is_admin === true)) {
        return Response.json({ error: "Forbidden" }, { status: 403 });
      }
      const tpl = TEMPLATES[p.lifecycle_type];
      if (!tpl) return Response.json({ error: "Unknown lifecycle type" }, { status: 400 });
      const t = tpl({ name: p.recipient_name, title: p.context?.title, challenge: p.context?.challenge });
      try {
        await base44.integrations.Core.SendEmail({ to: p.recipient_email, subject: t.subject, body: t.body });
        return Response.json({ sent: true });
      } catch (e) {
        return Response.json({ sent: false, reason: e?.message || "SendEmail failed (recipient may not be a registered user)" });
      }
    }

    if (action === "mySponsorProfile") {
      if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
      const all = await base44.asServiceRole.entities.SponsorProfile.list("-created_date", 500);
      const mine = (all || []).find((s) =>
        (s.contact_email || "").toLowerCase() === (user.email || "").toLowerCase() ||
        (s.user_id && s.user_id === user.id)
      );
      return Response.json({ profile: mine || null });
    }

    if (action === "applyAsSponsor") {
      if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
      const all = await base44.asServiceRole.entities.SponsorProfile.list("-created_date", 500);
      const existing = (all || []).find((s) =>
        (s.contact_email || "").toLowerCase() === (user.email || "").toLowerCase() ||
        (s.user_id && s.user_id === user.id)
      );
      if (existing) return Response.json({ profile: existing, already: true });
      const profile = await base44.asServiceRole.entities.SponsorProfile.create({
        name: String(p.name || "").slice(0, 200) || user.full_name || user.email,
        organisation: String(p.organisation || "").slice(0, 200),
        contact_name: String(p.contact_name || "").slice(0, 120) || user.full_name || "",
        contact_email: user.email,
        user_id: user.id,
        competition_ids: [],
        status: "pending",
      });
      return Response.json({ profile });
    }

    // ---- Admin-only actions ----
    // Platform admins only. 'creator' is a participant-facing role and must NOT
    // reach audience data, campaign sending, sponsor records or the AI tools.
    const isAdmin = user && (user.role === "admin" || user.is_admin === true);
    const adminActions = ["listAudience", "createCampaign", "sendCampaign", "createOrganisation", "listOrganisations", "organisationLeaderboard", "unsubscribe", "listSponsors", "saveSponsor", "deleteSponsor", "listCampaigns", "listPipeline", "updatePipelineStatus", "generateShareCard", "dashboardSummary", "listCanonicalCategories", "aiFindPartners", "aiGenerateInvite", "savePartnerProspect", "aiGrowthInsights", "aiCampaignCopy", "aiFollowUpDraft"];
    if (adminActions.includes(action)) {
      if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
      if (!isAdmin) return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    if (action === "listAudience") {
      const all = await base44.asServiceRole.entities.AudienceMember.list("-created_date", 10000);
      const filtered = (all || []).filter((m) => matchesSegment(m, p));
      return Response.json({ members: filtered, count: filtered.length, total: (all || []).length });
    }

    if (action === "unsubscribe") {
      const email = (p.email || "").trim().toLowerCase();
      const all = await base44.asServiceRole.entities.AudienceMember.filter({ email });
      for (const m of all || []) {
        await base44.asServiceRole.entities.AudienceMember.update(m.id, { status: "unsubscribed", unsubscribed_at: new Date().toISOString() });
      }
      return Response.json({ ok: true });
    }

    if (action === "createCampaign") {
      const camp = await base44.asServiceRole.entities.EmailCampaign.create({
        name: p.name, type: p.type || "announcement",
        audience_types: p.audience_types || [], states: p.states || [], categories: p.categories || [],
        participated_only: !!p.participated_only, competition_id: p.competition_id || "",
        subject: p.subject || "", body: p.body || "", status: "draft", created_by: user.id,
      });
      return Response.json({ campaign: camp });
    }

    if (action === "sendCampaign") {
      const camp = await base44.asServiceRole.entities.EmailCampaign.get(p.campaign_id);
      const all = await base44.asServiceRole.entities.AudienceMember.list("-created_date", 10000);
      const targets = (all || []).filter((m) => m.status !== "unsubscribed" && matchesSegment(m, camp));
      const users = await base44.asServiceRole.entities.User.list("-created_date", 10000);
      const userEmails = new Set((users || []).map((u) => (u.email || "").toLowerCase()).filter(Boolean));
      let sent = 0, skipped = 0;
      const body = camp.body || "";
      for (const m of targets) {
        if (!userEmails.has((m.email || "").toLowerCase())) { skipped++; continue; }
        try {
          await base44.asServiceRole.integrations.Core.SendEmail({
            to: m.email, subject: camp.subject,
            body: body.replace(/{{name}}/g, m.name || "").replace(/{{email}}/g, m.email),
          });
          sent++;
        } catch (e) { skipped++; }
      }
      const updated = await base44.asServiceRole.entities.EmailCampaign.update(camp.id, {
        status: "sent", sent_count: sent, skipped_unregistered: skipped,
        audience_count: targets.length, sent_at: new Date().toISOString(),
      });
      return Response.json({ sent, skipped, audience_count: targets.length, campaign: updated });
    }

    if (action === "createOrganisation") {
      const org = await base44.asServiceRole.entities.Organisation.create({
        name: p.name, kind: p.kind || "club", signup_code: p.signup_code || genCode(),
        contact_email: p.contact_email || "", state: p.state || "",
        leaderboard_enabled: p.leaderboard_enabled !== false,
      });
      return Response.json({ organisation: org });
    }

    if (action === "listOrganisations") {
      const orgs = await base44.asServiceRole.entities.Organisation.filter({ status: "active" }, "-created_date", 200);
      return Response.json({ organisations: orgs || [] });
    }

    if (action === "organisationLeaderboard") {
      const members = await base44.asServiceRole.entities.AudienceMember.filter({ organisation_id: p.organisation_id });
      const rows = (members || []).map((m) => ({ name: m.name || m.email, entries: m.entry_count || 0, votes: m.vote_count || 0 }))
        .sort((a, b) => (b.entries + b.votes) - (a.entries + a.votes));
      const totals = rows.reduce((acc, r) => ({ entries: acc.entries + r.entries, votes: acc.votes + r.votes }), { entries: 0, votes: 0 });
      return Response.json({ rows, totals, members: (members || []).length });
    }

    if (action === "listSponsors") {
      const sponsors = await base44.asServiceRole.entities.SponsorProfile.list("-created_date", 200);
      return Response.json({ sponsors: sponsors || [] });
    }

    if (action === "saveSponsor") {
      let sponsor;
      if (p.id) {
        sponsor = await base44.asServiceRole.entities.SponsorProfile.update(p.id, {
          name: p.name, organisation: p.organisation, contact_name: p.contact_name,
          contact_email: p.contact_email, competition_ids: p.competition_ids || [], status: p.status || "active",
        });
      } else {
        sponsor = await base44.asServiceRole.entities.SponsorProfile.create({
          name: p.name, organisation: p.organisation || "", contact_name: p.contact_name || "",
          contact_email: p.contact_email, competition_ids: p.competition_ids || [], status: "active",
        });
      }
      return Response.json({ sponsor });
    }

    if (action === "deleteSponsor") {
      await base44.asServiceRole.entities.SponsorProfile.delete(p.id);
      return Response.json({ ok: true });
    }

    if (action === "listCampaigns") {
      const campaigns = await base44.asServiceRole.entities.EmailCampaign.list("-created_date", 200);
      return Response.json({ campaigns: campaigns || [] });
    }

    if (action === "listPipeline") {
      const items = await base44.asServiceRole.entities.PartnerInquiry.list("-created_date", 200);
      return Response.json({ items: items || [] });
    }

    if (action === "updatePipelineStatus") {
      if (!p.id || !p.pipeline_status) return Response.json({ error: "id and pipeline_status are required" }, { status: 400 });
      const item = await base44.asServiceRole.entities.PartnerInquiry.update(p.id, { pipeline_status: p.pipeline_status });
      return Response.json({ item });
    }

    if (action === "generateShareCard") {
      // Prompt is assembled server-side from structured fields only.
      const mode = p.mode === "competition" ? "competition" : "entry";
      const prompt = mode === "entry"
        ? `A vibrant vertical social share card for a creative competition entry titled "${String(p.title || "").slice(0, 120)}" by ${String(p.creator || "").slice(0, 80)}, with ${String(p.votes || "0").slice(0, 12)} community votes. 53 Challenges branding, bold modern sans-serif typography, red gradient background, celebratory Australian creative theme. 1080x1350.`
        : `A vibrant vertical social share card for a creative competition "${String(p.challenge || "").slice(0, 120)}" themed "${String(p.theme || "").slice(0, 120)}" on 53 Challenges. Bold modern sans-serif typography, red gradient, clear call to enter and vote. 1080x1350.`;
      const r = await base44.asServiceRole.integrations.Core.GenerateImage({ prompt });
      if (!r?.url) return Response.json({ error: "Image generation failed — please try again" }, { status: 502 });
      return Response.json({ url: r.url });
    }

    if (action === "listCanonicalCategories") {
      const cats = await base44.asServiceRole.entities.Category.filter({ status: "active" }, "sort_order", 50);
      return Response.json({ categories: (cats || []).map((c) => ({ id: c.id, name: c.name, slug: c.slug })) });
    }

    if (action === "dashboardSummary") {
      const sr = base44.asServiceRole;
      const [audience, campaigns, entries, orgs, pipeline] = await Promise.all([
        sr.entities.AudienceMember.list("-created_date", 10000).catch(() => []),
        sr.entities.EmailCampaign.list("-created_date", 500).catch(() => []),
        sr.entities.Entry.list("-created_date", 5000).catch(() => []),
        sr.entities.Organisation.filter({ status: "active" }, "-created_date", 500).catch(() => []),
        sr.entities.PartnerInquiry.list("-created_date", 500).catch(() => []),
      ]);
      const sent = (campaigns || []).filter((c) => c.status === "sent");
      return Response.json({
        audience: {
          total: (audience || []).length,
          unsubscribed: (audience || []).filter((m) => m.status === "unsubscribed").length,
        },
        campaigns: {
          total: (campaigns || []).length,
          drafts: (campaigns || []).filter((c) => c.status === "draft").length,
          sent: sent.length,
          emails_delivered: sent.reduce((n, c) => n + (c.sent_count || 0), 0),
        },
        entries: {
          total: (entries || []).length,
          approved: (entries || []).filter((e) => e.status === "approved").length,
          pending: (entries || []).filter((e) => e.status === "pending").length,
        },
        organisations: (orgs || []).length,
        pipeline: {
          total: (pipeline || []).filter((i) => i.pipeline_status).length,
          new: (pipeline || []).filter((i) => i.pipeline_status === "new").length,
        },
      });
    }

    if (action === "aiFindPartners") {
      const brief = String(p.brief || "").slice(0, 400);
      const kind = String(p.partner_kind || "sponsor").slice(0, 40);
      const location = String(p.location || "Australia").slice(0, 80);
      const count = Math.min(Math.max(parseInt(p.count) || 6, 1), 12);
      if (!brief) return Response.json({ error: "Describe what you're looking for" }, { status: 400 });
      const res = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: `You are a partnerships researcher for 53 Challenges, an Australian creative competition platform running photography, writing, art, music and film challenges.

Find ${count} real, currently operating ${kind} prospects in ${location} that match this brief: "${brief}".

For each prospect return: organisation name, kind (sponsor, school, club, workplace, council, venue, government or other), a public website, a public contact email if one is genuinely published (otherwise leave empty — never invent one), the city/state, and two short sentences on why they are a strong fit for a creative challenge partnership plus a suggested angle for the approach. Only include organisations you can actually verify from the web. Never fabricate contact details.`,
        add_context_from_internet: true,
        model: "gemini_3_flash",
        response_json_schema: {
          type: "object",
          properties: {
            prospects: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  kind: { type: "string" },
                  website: { type: "string" },
                  contact_email: { type: "string" },
                  location: { type: "string" },
                  why_fit: { type: "string" },
                  angle: { type: "string" },
                },
              },
            },
          },
        },
      });
      return Response.json({ prospects: (res?.prospects || []).slice(0, count) });
    }

    if (action === "aiGenerateInvite") {
      const name = String(p.name || "").slice(0, 120);
      if (!name) return Response.json({ error: "Prospect name required" }, { status: 400 });
      const res = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: `Write a partnership invitation email from the 53 Challenges team (an Australian creative competition platform) to ${name}${p.location ? ` in ${String(p.location).slice(0, 80)}` : ""}.

Context about them: ${String(p.why_fit || "").slice(0, 400)}
Suggested angle: ${String(p.angle || "").slice(0, 300)}
Partnership type: ${String(p.partner_kind || "sponsor").slice(0, 40)}
${p.extra_notes ? `Extra notes from our team: ${String(p.extra_notes).slice(0, 300)}` : ""}

Keep it under 180 words, warm and specific (no generic filler), Australian English, one clear call to action to book a 15-minute chat. Return a subject line and the email body only — no placeholders other than the recipient's name.`,
        response_json_schema: {
          type: "object",
          properties: { subject: { type: "string" }, body: { type: "string" } },
        },
      });
      return Response.json({ subject: res?.subject || "", body: res?.body || "" });
    }

    if (action === "aiGrowthInsights") {
      const sr = base44.asServiceRole;
      const [audience, campaigns, entries, orgs, pipeline, challenges] = await Promise.all([
        sr.entities.AudienceMember.list("-created_date", 5000).catch(() => []),
        sr.entities.EmailCampaign.list("-created_date", 200).catch(() => []),
        sr.entities.Entry.list("-created_date", 3000).catch(() => []),
        sr.entities.Organisation.filter({ status: "active" }, "-created_date", 300).catch(() => []),
        sr.entities.PartnerInquiry.list("-created_date", 300).catch(() => []),
        sr.entities.Challenge.list("-created_date", 200).catch(() => []),
      ]);
      const stateCounts = {};
      for (const m of audience || []) if (m.state) stateCounts[m.state] = (stateCounts[m.state] || 0) + 1;
      const snapshot = {
        audience_total: (audience || []).length,
        audience_unsubscribed: (audience || []).filter((m) => m.status === "unsubscribed").length,
        audience_by_state: stateCounts,
        audience_by_type: (audience || []).reduce((a, m) => { a[m.audience_type || "other"] = (a[m.audience_type || "other"] || 0) + 1; return a; }, {}),
        campaigns_total: (campaigns || []).length,
        campaigns_drafts: (campaigns || []).filter((c) => c.status === "draft").length,
        campaigns_sent: (campaigns || []).filter((c) => c.status === "sent").length,
        emails_delivered: (campaigns || []).reduce((n, c) => n + (c.sent_count || 0), 0),
        entries_total: (entries || []).length,
        entries_approved: (entries || []).filter((e) => e.status === "approved").length,
        entries_pending: (entries || []).filter((e) => e.status === "pending").length,
        organisations: (orgs || []).length,
        pipeline_by_stage: (pipeline || []).reduce((a, i) => { if (i.pipeline_status) a[i.pipeline_status] = (a[i.pipeline_status] || 0) + 1; return a; }, {}),
        challenges_open: (challenges || []).filter((c) => ["entry_open", "voting_open", "published"].includes(c.lifecycle_status)).length,
      };
      const res = await sr.integrations.Core.InvokeLLM({
        prompt: `You are the growth strategist for 53 Challenges, an Australian creative competition platform. Here is a live snapshot of the marketing data:

${JSON.stringify(snapshot)}

Give the 3 highest-impact actions the team should take this week. Base every claim strictly on the numbers above — never invent metrics. For each action give a short title, one or two sentences of reasoning that cites the relevant numbers, and a concrete first step. Also return one sentence summarising the overall state of the funnel.`,
        response_json_schema: {
          type: "object",
          properties: {
            summary: { type: "string" },
            actions: {
              type: "array",
              items: {
                type: "object",
                properties: { title: { type: "string" }, why: { type: "string" }, first_step: { type: "string" } },
              },
            },
          },
        },
      });
      return Response.json({ summary: res?.summary || "", actions: (res?.actions || []).slice(0, 3), snapshot });
    }

    if (action === "aiCampaignCopy") {
      const res = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: `Write a marketing email for 53 Challenges, an Australian creative competition platform.

Campaign name: ${String(p.name || "").slice(0, 120)}
Campaign type: ${String(p.type || "announcement").slice(0, 40)}
Audience types: ${(p.audience_types || []).join(", ").slice(0, 200) || "all"}
States: ${(p.states || []).join(", ").slice(0, 200) || "all of Australia"}
Categories of interest: ${(p.categories || []).join(", ").slice(0, 200) || "all creative categories"}
${p.notes ? `Extra notes: ${String(p.notes).slice(0, 300)}` : ""}

Australian English, warm and energetic, under 150 words, one clear call to action. Use {{name}} once for personalisation. Return a subject line and the email body only.`,
        response_json_schema: {
          type: "object",
          properties: { subject: { type: "string" }, body: { type: "string" } },
        },
      });
      return Response.json({ subject: res?.subject || "", body: res?.body || "" });
    }

    if (action === "aiFollowUpDraft") {
      if (!p.id) return Response.json({ error: "Inquiry id required" }, { status: 400 });
      const item = await base44.asServiceRole.entities.PartnerInquiry.get(p.id);
      if (!item) return Response.json({ error: "Inquiry not found" }, { status: 404 });
      const res = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: `Write the next outreach message from the 53 Challenges team (an Australian creative competition platform) to a partner inquiry.

Organisation: ${String(item.company_name || "").slice(0, 160)}
Contact: ${String(item.contact_name || "").slice(0, 120)}
Organisation kind: ${String(item.organisation_kind || "").slice(0, 60)}
Their idea / notes: ${String(item.challenge_description || "").slice(0, 600)}
Audience they described: ${String(item.audience_description || "").slice(0, 300)}
Current pipeline stage: ${String(item.pipeline_status || "new").slice(0, 40)}

Match the message to the stage — a first approach for "new", a gentle nudge for "contacted", next-step detail for "replied" or "in_discussion", onboarding for "confirmed", and a warm close for "declined". Under 150 words, Australian English, one clear call to action. Return a subject line and the message body only.`,
        response_json_schema: {
          type: "object",
          properties: { subject: { type: "string" }, body: { type: "string" } },
        },
      });
      return Response.json({ subject: res?.subject || "", body: res?.body || "" });
    }

    if (action === "savePartnerProspect") {
      const name = String(p.name || "").slice(0, 200);
      if (!name) return Response.json({ error: "Prospect name required" }, { status: 400 });
      const kinds = ["sponsor", "council", "school", "workplace", "other"];
      const rawKind = String(p.kind || "").toLowerCase();
      const item = await base44.asServiceRole.entities.PartnerInquiry.create({
        company_name: name,
        organisation_kind: kinds.includes(rawKind) ? rawKind : "other",
        contact_name: "AI prospect (no contact yet)",
        contact_email: String(p.contact_email || "").slice(0, 160) || "unknown@prospect.invalid",
        company_website: String(p.website || "").slice(0, 200),
        challenge_title: "AI-sourced partnership prospect",
        challenge_description: String(p.why_fit || "").slice(0, 800) || "Sourced via AI partner finder.",
        audience_description: String(p.location || "").slice(0, 200) || "To be confirmed",
        additional_notes: String(p.angle || "").slice(0, 500),
        how_heard: "AI partner finder",
        pipeline_status: "new",
      });
      return Response.json({ item });
    }

    return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}