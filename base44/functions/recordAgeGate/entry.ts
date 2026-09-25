import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { verifyCustomSession } from '../../shared/customSession.ts';
import { secrets } from 'base44:runtime';

const MIN_SELF_REGISTER_AGE = 16;

function parseDob(iso) {
  const s = String(iso || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  if (d.toISOString().slice(0, 10) !== s) return null;
  return d;
}

function ageFromDob(iso) {
  const d = parseDob(iso);
  if (!d) return null;
  const now = new Date();
  let age = now.getUTCFullYear() - d.getUTCFullYear();
  const m = now.getUTCMonth() - d.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < d.getUTCDate())) age -= 1;
  if (age < 0 || age > 120) return null;
  return age;
}

async function identify(base44, body) {
  const platformUser = await base44.auth.me().catch(() => null);
  if (platformUser?.email) return platformUser;
  const apiKey = secrets.get('CHALLENGE_API_KEY') || Deno.env.get('CHALLENGE_API_KEY');
  const session = await verifyCustomSession(String(body.session_token || ''), apiKey);
  if (session?.email) return { id: session.uid, email: session.email };
  return null;
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const user = await identify(base44, body);
    if (!user?.email) {
      return Response.json({ error: 'You must be signed in.' }, { status: 401 });
    }
    const email = String(user.email).trim().toLowerCase();
    const sr = base44.asServiceRole;

    if (body.action === 'status') {
      const rows = await sr.entities.AgeAttestation.filter({ email }, '-created_date', 1).catch(() => []);
      const row = rows?.[0];
      return Response.json({
        ok: row?.status === 'confirmed',
        status: row?.status || 'missing',
        age_years: row?.age_years ?? null,
      });
    }

    const dob = String(body.date_of_birth || '');
    const age = ageFromDob(dob);
    if (age == null) {
      return Response.json({ error: 'Enter a valid date of birth.' }, { status: 400 });
    }
    if (age < MIN_SELF_REGISTER_AGE) {
      await sr.entities.AgeAttestation.create({
        user_id: user.id || '',
        email,
        date_of_birth: dob,
        age_years: age,
        status: 'blocked_underage',
      }).catch(() => {});
      return Response.json({
        error: 'Accounts for people under 16 must be created by a parent or guardian.',
        blocked: true,
        age,
      }, { status: 403 });
    }

    await sr.entities.AgeAttestation.create({
      user_id: user.id || '',
      email,
      date_of_birth: dob,
      age_years: age,
      status: 'confirmed',
    });
    return Response.json({ ok: true, age });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
