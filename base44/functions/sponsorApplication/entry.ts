import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { fetchChallengeApi } from '../../shared/challengeApiHelper.ts';
import { assertEmailVerified } from '../../shared/emailVerification.ts';

// Forwards sponsorship enquiries to the parent site's
// publicChallengeApi (action: submit_sponsor_application) so the API key
// never reaches the browser.
export default async function (req) {
  try {
    let input: any = {};
    try { input = await req.json(); } catch { /* no body */ }

    if ((input.action || 'submit') !== 'submit') {
      return Response.json({ error: `Unknown action: ${input.action}` }, { status: 400 });
    }

    const required = ['organisation_name', 'contact_name', 'contact_email', 'challenge_title', 'challenge_description'];
    for (const f of required) {
      if (!String(input[f] || '').trim()) {
        return Response.json({ error: `${f.replace(/_/g, ' ')} is required` }, { status: 400 });
      }
    }

    // Two-factor: the enquiry only goes through if a code emailed to this
    // address was confirmed — stops enquiries sent under someone else's email.
    const base44 = createClientFromRequest(req);
    try {
      await assertEmailVerified(base44, input.contact_email, 'sponsor_application', input.verification_token);
    } catch (e) {
      return Response.json({ error: e.message }, { status: 400 });
    }

    const params = {
      organisation_type: input.organisation_type || 'Sponsor / Brand',
      organisation_name: input.organisation_name,
      contact_name: input.contact_name,
      contact_email: input.contact_email,
      phone: input.phone || '',
      website: input.website || '',
      geographic_scope: input.geographic_scope || 'National',
      challenge_title: input.challenge_title,
      challenge_description: input.challenge_description,
      audience: input.audience || '',
      audience_size: input.audience_size || '',
      estimated_budget: input.estimated_budget || '',
      launch_timing: input.launch_timing || '',
    };

    const json: any = await fetchChallengeApi(
      'submit_sponsor_application',
      params,
      Deno.env.get('CHALLENGE_API_KEY'),
      Deno.env.get('CHALLENGE_API_BASE_URL'),
    );

    if (json?.error) {
      return Response.json({ error: json.error, duplicate: !!json.duplicate }, { status: json.duplicate ? 409 : 400 });
    }
    return Response.json({ success: true, application_id: json?.application_id || json?.id || '' });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}