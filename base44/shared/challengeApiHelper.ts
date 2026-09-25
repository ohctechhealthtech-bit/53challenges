const DEFAULT_BASE = "https://base44.app/api/apps/69341410f89d26a8fc73a4d1/functions/publicChallengeApi";
const GET_ACTIONS = new Set(["challenges", "entries", "votes"]);
const GET_PARAMS = ["status", "stage", "season", "id", "limit", "challenge_id", "sort", "user_email", "featured", "phase", "category", "division", "state", "page", "offset", "include_inactive"];

const DEFAULT_ADMIN_BASE = "https://base44.app/api/apps/69341410f89d26a8fc73a4d1/functions/adminChallengeApi";

// The parent app's adminChallengeApi lives on the same host, behind the same
// x-api-key. Derive its URL from CHALLENGE_API_BASE_URL by swapping the
// trailing function name; ADMIN_CHALLENGE_API_BASE_URL overrides it.
export function adminBaseUrl(publicBase, adminOverride) {
  if (adminOverride) return adminOverride;
  if (!publicBase) return DEFAULT_ADMIN_BASE;
  return publicBase.replace(/\/[^/]*$/, "/adminChallengeApi");
}

// POST { action, params } → { ok: true, data } | { ok: false, error: { code, message } }
export async function fetchAdminChallengeApi(action, params, apiKey, baseUrl) {
  if (!apiKey) throw new Error("CHALLENGE_API_KEY secret not set");
  const res = await fetch(baseUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey },
    body: JSON.stringify({ action, params: params || {} }),
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    return {
      ok: false,
      error: { code: "bad_response", message: `Parent returned non-JSON (HTTP ${res.status}): ${text.slice(0, 300)}` },
      status: res.status,
    };
  }
  return { ...json, status: res.status };
}

export async function fetchChallengeApi(action, params, apiKey, baseUrl) {
  if (!apiKey) throw new Error("CHALLENGE_API_KEY secret not set");
  const BASE = baseUrl || DEFAULT_BASE;

  if (GET_ACTIONS.has(action)) {
    const urlParams = new URLSearchParams({ action });
    for (const k of GET_PARAMS) {
      if (params[k] !== undefined && params[k] !== null && params[k] !== "") {
        urlParams.set(k, String(params[k]));
      }
    }
    const res = await fetch(`${BASE}?${urlParams.toString()}`, {
      headers: { "x-api-key": apiKey },
    });
    return res.json();
  } else {
    const res = await fetch(BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey },
      body: JSON.stringify({ action, ...params }),
    });
    return res.json();
  }
}