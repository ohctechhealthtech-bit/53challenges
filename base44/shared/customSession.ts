// Signed session tokens for the app's custom (Challenge-API) login.
//
// The custom login authenticates against the upstream Challenge API, so those
// users have no Base44 platform session. To still derive identity SERVER-SIDE
// (never from a client-supplied email), the login proxy mints an HMAC-signed
// token here and backend functions verify it.
//
// The signing key is derived from the server-only CHALLENGE_API_KEY secret, so
// a token cannot be forged by a browser.

const TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days

function b64urlEncode(bytes: Uint8Array) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(str: string) {
  const pad = str.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(pad + "=".repeat((4 - (pad.length % 4)) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function hmacKey(apiKey: string) {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(`c53-custom-session:${apiKey}`),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
}

async function sign(payloadB64: string, apiKey: string) {
  const key = await hmacKey(apiKey);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payloadB64));
  return b64urlEncode(new Uint8Array(sig));
}

/** Mint a signed session token for a Challenge-API user. */
export async function signCustomSession(
  user: { id?: string; email: string; full_name?: string },
  apiKey: string
) {
  const payload = {
    email: String(user.email || "").toLowerCase().trim(),
    name: user.full_name || "",
    uid: user.id || "",
    exp: Math.floor(Date.now() / 1000) + TTL_SECONDS,
  };
  const payloadB64 = b64urlEncode(new TextEncoder().encode(JSON.stringify(payload)));
  return `${payloadB64}.${await sign(payloadB64, apiKey)}`;
}

/** Verify a token. Returns the payload, or null when invalid/expired. */
export async function verifyCustomSession(token: string, apiKey: string) {
  if (!token || !apiKey) return null;
  const [payloadB64, sig] = String(token).split(".");
  if (!payloadB64 || !sig) return null;
  const expected = await sign(payloadB64, apiKey);
  if (expected.length !== sig.length) return null;
  // Constant-time-ish comparison.
  let diff = 0;
  for (let i = 0; i < sig.length; i++) diff |= sig.charCodeAt(i) ^ expected.charCodeAt(i);
  if (diff !== 0) return null;
  try {
    const payload = JSON.parse(new TextDecoder().decode(b64urlDecode(payloadB64)));
    if (!payload?.email) return null;
    if (!payload.exp || payload.exp * 1000 < Date.now()) return null;
    return payload as { email: string; name: string; uid: string; exp: number };
  } catch {
    return null;
  }
}