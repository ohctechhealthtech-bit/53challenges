// The credentials issued by the custom (Challenge-API) login.
//
// There are two, because two backends read them. Ported functions verify the
// signed session token, which arrives in the request body. The entity API
// cannot read a body — a GET has none — so it reads a JWT from the
// Authorization header, which is where the Base44 SDK puts ACCESS_KEY. Both
// are minted from the same login and carry the same identity.
const KEY = 'challengeApi_session_token';

// The SDK reads this key itself at module load (see lib/app-params.js), so the
// name is not ours to choose.
const ACCESS_KEY = 'base44_access_token';

export function setSessionToken(token) {
  try {
    if (token) localStorage.setItem(KEY, token);
  } catch { /* storage unavailable */ }
}

export function getSessionToken() {
  try {
    return localStorage.getItem(KEY) || '';
  } catch {
    return '';
  }
}

/** The JWT the entity API authenticates. Ignores a missing value. */
export function setAccessToken(token) {
  try {
    if (token) localStorage.setItem(ACCESS_KEY, token);
  } catch { /* storage unavailable */ }
}

export function getAccessToken() {
  try {
    return localStorage.getItem(ACCESS_KEY) || '';
  } catch {
    return '';
  }
}

/**
 * Ends the session.
 *
 * Clears both credentials deliberately: they are one session, and a JWT
 * left behind would keep the entity API treating a signed-out browser as
 * signed in until the token expired fourteen days later.
 */
export function clearSessionToken() {
  try { localStorage.removeItem(KEY); } catch { /* storage unavailable */ }
  try { localStorage.removeItem(ACCESS_KEY); } catch { /* storage unavailable */ }
}
