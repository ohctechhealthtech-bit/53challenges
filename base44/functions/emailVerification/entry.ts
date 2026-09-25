import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { sendVerificationCode, confirmVerificationCode } from '../../shared/emailVerification.ts';

// Public endpoint — guests (sponsors, judges, guardians) must be able to
// verify an address before they have an account.
const PURPOSES = {
  sponsor_application: 'your sponsorship enquiry',
  judge_application: 'your judge application',
  guardian_consent: 'guardian consent for a challenge entry',
  host_application: 'your challenge hosting request',
  challenge_entry: 'your challenge entry',
};

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    let input: any = {};
    try { input = await req.json(); } catch { /* no body */ }

    const purpose = String(input.purpose || '');
    if (!PURPOSES[purpose]) return Response.json({ error: 'Unknown verification purpose' }, { status: 400 });

    if (input.action === 'send') {
      const r = await sendVerificationCode(base44, input.email, purpose, PURPOSES[purpose]);
      return Response.json({ success: true, ...r });
    }
    if (input.action === 'verify') {
      const r = await confirmVerificationCode(base44, input.email, purpose, input.code);
      if (r.error) return Response.json({ error: r.error }, { status: 400 });
      return Response.json(r);
    }
    return Response.json({ error: `Unknown action: ${input.action}` }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}