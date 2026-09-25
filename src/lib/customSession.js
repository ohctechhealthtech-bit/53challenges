// Server-signed session token issued by the custom (Challenge-API) login.
// Backend functions verify it to derive the entrant's identity.
const KEY = 'challengeApi_session_token';

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

export function clearSessionToken() {
  try { localStorage.removeItem(KEY); } catch { /* storage unavailable */ }
}