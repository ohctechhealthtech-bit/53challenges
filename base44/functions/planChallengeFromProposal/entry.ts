import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

const CATEGORIES = [
  'visual-arts',
  'photography',
  'writing',
  'digital-creativity',
  'performance-voice',
  'open-experimental',
];

// Called by the "Challenge Planning" workflow whenever a PartnerInquiry
// (host-a-challenge proposal) is created, and by admins from the Ty chat.
// Acts as "Ty" — uses InvokeLLM to draft a structured, actionable challenge
// plan from the proposal, then persists it back onto the inquiry record.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const sr = base44.asServiceRole;

    const body = await req.json().catch(() => ({}));
    const { inquiry_id } = body;
    if (!inquiry_id) {
      return Response.json({ error: "Missing inquiry_id" }, { status: 400 });
    }

    // Guard: allow workflow invocation (no user). If a user is present,
    // require the admin role — runs from the Ty chat are admin-only.
    const me = await base44.auth.me().catch(() => null);
    if (me && me.role !== 'admin') {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const inquiry = await sr.entities.PartnerInquiry.get(inquiry_id);
    if (!inquiry) {
      return Response.json({ error: "Inquiry not found" }, { status: 404 });
    }

    const proposalText = [
      `Company: ${inquiry.company_name}`,
      `Industry: ${inquiry.industry || 'n/a'}`,
      `Website: ${inquiry.company_website || 'n/a'}`,
      `Working title / theme: ${inquiry.challenge_title}`,
      `Challenge type: ${inquiry.challenge_type || 'n/a'}`,
      `Main goal: ${inquiry.challenge_goal || 'n/a'}`,
      `Description: ${inquiry.challenge_description}`,
      `Target participants: ${inquiry.audience_description}`,
      `Expected participants: ${inquiry.audience_size || 'n/a'}`,
      `Geographic scope: ${inquiry.geographic_scope || 'n/a'}`,
      `Launch timing: ${inquiry.launch_timing || 'n/a'}`,
      `Budget: ${inquiry.estimated_budget || 'n/a'}`,
      `Prize format: ${inquiry.prize_format || 'n/a'}`,
      `Additional notes: ${inquiry.additional_notes || 'n/a'}`,
    ].join('\n');

    const prompt = `You are Ty, the challenge planning assistant for 53 Challenges — Australia's creative competition platform. A brand or partner has submitted a proposal to host a challenge. Read the proposal below and draft a clear, actionable challenge plan that the partnerships team can refine with the client.

Return a structured JSON plan with:
- recommended_title: a punchy public-facing title
- theme: a one-line creative theme
- category: exactly one of ${CATEGORIES.join(', ')}
- brief: a 2-3 sentence brief describing what participants should create
- target_audience: a refined target-audience description
- suggested_timeline: proposed submission + voting duration (e.g. "2 weeks submissions + 1 week voting")
- prize_structure: recommended prize approach based on budget and prize_format
- next_steps: 3-5 concise next steps for the partnerships team
- summary: a 1-2 sentence plain-language summary

Be practical, encouraging and specific to the proposal.

Proposal details:
${proposalText}`;

    const plan = await sr.integrations.Core.InvokeLLM({
      prompt,
      model: 'gpt_5_mini',
      response_json_schema: {
        type: 'object',
        properties: {
          recommended_title: { type: 'string' },
          theme: { type: 'string' },
          category: { type: 'string', enum: CATEGORIES },
          brief: { type: 'string' },
          target_audience: { type: 'string' },
          suggested_timeline: { type: 'string' },
          prize_structure: { type: 'string' },
          next_steps: { type: 'array', items: { type: 'string' } },
          summary: { type: 'string' },
        },
        required: [
          'recommended_title',
          'theme',
          'category',
          'brief',
          'target_audience',
          'suggested_timeline',
          'prize_structure',
          'next_steps',
          'summary',
        ],
      },
    });

    await sr.entities.PartnerInquiry.update(inquiry_id, {
      ai_plan: plan,
      status: 'planning',
    });

    return Response.json({ success: true, plan });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}