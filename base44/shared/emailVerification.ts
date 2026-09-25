// Shared email two-factor (one-time code) helper.
// Codes are sent and checked by the main 53 site's OTP service (emailOtp),
// which can email anyone. We keep a local record of each verified token so
// submitting functions can gate on it and forward the same token upstream.
import { getSecret } from './secretsEnv.ts';

const norm = (v) => String(v || '').trim().toLowerCase();

// Our purposes → the OTP service's purposes.
const UPSTREAM_PURPOSE = {
  challenge_entry: 'participation',
  guardian_consent: 'participation',
  sponsor_application: 'sponsor_request',
  judge_application: 'judge_request',
  host_application: 'host_request',
};

function otpUrl() {
  const base = getSecret('CHALLENGE_API_BASE_URL')
    || 'https://base44.app/api/apps/69341410f89d26a8fc73a4d1/functions/publicChallengeApi';
  return base.replace(/\/[^/]*$/, '/emailOtp');
}

async function sha256Hex(value) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(value || '')));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function callOtp(body) {
  const apiKey = getSecret('CHALLENGE_API_KEY');
  if (!apiKey) throw new Error('CHALLENGE_API_KEY secret not set');
  const res = await fetch(otpUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json: any = {};
  try { json = JSON.parse(text); } catch { json = { error: `OTP service returned HTTP ${res.status}` }; }
  if (!res.ok || json.ok === false || json.error) {
    const msg = json?.error?.message || json?.error || json?.message || `OTP service error (HTTP ${res.status})`;
    return { error: String(msg) };
  }
  return json.data || json;
}

// Asks the OTP service to email a fresh code.
export async function sendVerificationCode(base44, email, purpose, _label) {
  const to = norm(email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(to)) throw new Error('Please enter a valid email address');
  const r = await callOtp({ email: to, purpose: UPSTREAM_PURPOSE[purpose] || purpose });
  if (r.error) throw new Error(r.error);
  return { expires_at: r.expires_at };
}

// Checks a code with the OTP service and, on success, records the token
// locally so submitting functions can require it as proof.
export async function confirmVerificationCode(base44, email, purpose, code) {
  const to = norm(email);
  const clean = String(code || '').trim();
  if (clean.length !== 6) return { error: 'Please enter the 6-digit code from the email.' };
  const r = await callOtp({ action: 'verify', email: to, purpose: UPSTREAM_PURPOSE[purpose] || purpose, code: clean });
  if (r.error) return { error: r.error };
  const token = r.verification_token;
  if (!token) return { error: 'That code could not be confirmed. Please request a new one.' };
  await base44.asServiceRole.entities.EmailVerification.create({
    email: to,
    purpose,
    code: await sha256Hex(clean),
    token,
    verified: true,
    consumed: false,
    verified_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  });
  return { success: true, verification_token: token };
}

// Checks the token WITHOUT consuming it, returning the row so the caller can
// consume it later. Use this when work can still fail after the check — a
// consumed token cannot be reused, so burning it up front leaves the entrant
// unable to retry and with no way to request a new code.
export async function checkEmailVerified(base44, email, purpose, token) {
  const to = norm(email);
  const tok = String(token || '').trim();
  if (!tok) throw new Error('Please verify your email address first.');

  const rows = await base44.asServiceRole.entities.EmailVerification.filter({
    email: to, purpose, token: tok, verified: true, consumed: false,
  }, '-created_date', 1);

  if (rows.length) {
    const row = rows[0];
    if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) {
      throw new Error('That verification has expired. Please request a new code.');
    }
    return row;
  }

  // Nothing matched. Work out WHICH condition failed rather than returning the
  // same opaque message for five different causes — "request a new code" is
  // wrong advice when the real problem is a token issued for another address.
  const forEmail = await base44.asServiceRole.entities.EmailVerification
    .filter({ email: to, purpose }, '-created_date', 10).catch(() => []);
  const byToken = (forEmail || []).filter((r) => String(r.token || '').trim() === tok);

  let reason = 'unknown';
  if (!forEmail.length) reason = 'no_verification_for_this_email';
  else if (!byToken.length) reason = 'token_belongs_to_a_different_address';
  else if (byToken.every((r) => r.consumed)) reason = 'token_already_used';
  else if (byToken.every((r) => !r.verified)) reason = 'code_never_confirmed';

  console.log('[checkEmailVerified] miss', JSON.stringify({
    email: to, purpose, reason,
    rows_for_email: (forEmail || []).length,
    rows_for_token: byToken.length,
  }));

  throw new Error(`Email verification could not be confirmed. Please request a new code. [${reason}]`);
}

/** Marks a row returned by checkEmailVerified as used. Call only once the work succeeded. */
export async function consumeEmailVerification(base44, row) {
  if (!row?.id) return false;
  await base44.asServiceRole.entities.EmailVerification.update(row.id, {
    consumed: true,
  }).catch(() => {});
  return true;
}

// Server-side gate: throws unless the token was issued for this email+purpose.
export async function assertEmailVerified(base44, email, purpose, token) {
  const to = norm(email);
  if (!String(token || '').trim()) throw new Error('Please verify your email address first.');
  const rows = await base44.asServiceRole.entities.EmailVerification.filter({
    email: to, purpose, token: String(token).trim(), verified: true, consumed: false,
  }, '-created_date', 1);
  if (!rows.length) throw new Error('Email verification could not be confirmed. Please request a new code.');
  const row = rows[0];
  if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) {
    throw new Error('That verification has expired. Please request a new code.');
  }
  await base44.asServiceRole.entities.EmailVerification.update(row.id, {
    consumed: true,
  }).catch(() => {});
  return true;
}