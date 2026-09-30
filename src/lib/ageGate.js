/** Age policy for self-serve accounts. Matches Safety & Wellbeing: guardian consent under 16. */
export const MIN_SELF_REGISTER_AGE = 16;

function parseDob(iso) {
  const s = String(iso || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  if (d.toISOString().slice(0, 10) !== s) return null;
  return d;
}

export function ageFromDob(iso, now = new Date()) {
  const d = parseDob(iso);
  if (!d) return null;
  let age = now.getUTCFullYear() - d.getUTCFullYear();
  const m = now.getUTCMonth() - d.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < d.getUTCDate())) age -= 1;
  if (age < 0 || age > 120) return null;
  return age;
}

export function canSelfRegister(iso, now = new Date()) {
  const age = ageFromDob(iso, now);
  if (age == null) {
    return { ok: false, age: null, reason: "Enter a valid date of birth." };
  }
  if (age < MIN_SELF_REGISTER_AGE) {
    return {
      ok: false,
      age,
      reason: "Accounts for people under 16 must be created by a parent or guardian. We cannot open an account from this form.",
    };
  }
  return { ok: true, age };
}

export function ageOkStorageKey(email) {
  return `53_age_ok:${String(email || "").trim().toLowerCase()}`;
}

export function markAgeOk(email) {
  try {
    localStorage.setItem(ageOkStorageKey(email), "1");
  } catch {}
}

export function hasAgeOk(email) {
  try {
    return localStorage.getItem(ageOkStorageKey(email)) === "1";
  } catch {
    return false;
  }
}

export function needsAgeGate(user) {
  if (!user?.email) return false;
  if (user.role === "admin" || user.is_admin === true) return false;
  if (user.date_of_birth || user.data?.date_of_birth) return false;
  return !hasAgeOk(user.email);
}

/**
 * Forgets the local "age confirmed" flag for an account.
 *
 * The server refuses an entry when it holds no age attestation, and this flag
 * is what was hiding that: it is set in the browser and never checked
 * anywhere else, so a user could carry it while the server knew nothing about
 * their age. Clearing it makes needsAgeGate true again and the app sends them
 * to /age-gate, which records the attestation server-side.
 */
export function clearAgeOk(email) {
  try {
    localStorage.removeItem(ageOkStorageKey(email));
  } catch { /* storage unavailable */ }
}
