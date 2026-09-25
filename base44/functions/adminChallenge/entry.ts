import { secrets } from "base44:runtime";
import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";
import { fetchAdminChallengeApi, adminBaseUrl } from "../../shared/challengeApiHelper.ts";
import { isAdminCaller } from "../../shared/adminAuth.ts";

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const isAdmin = await isAdminCaller(base44, body.session_token || "", secrets.get("CHALLENGE_API_KEY") || "");
    if (!isAdmin) return Response.json({ ok: false, error: { code: "forbidden", message: "Admins only" } }, { status: 403 });

    const action = body.action;
    if (!action) return Response.json({ ok: false, error: { code: "missing_action", message: "Missing action" } }, { status: 400 });

    const key = secrets.get("CHALLENGE_API_KEY");
    if (!key) return Response.json({ ok: false, error: { code: "no_key", message: "CHALLENGE_API_KEY secret not set" } }, { status: 500 });

    // Optional override — absent in most installs, so it is read defensively.
    let adminOverride = "";
    try { adminOverride = secrets.get(["ADMIN", "CHALLENGE", "API", "BASE", "URL"].join("_")) || ""; } catch { adminOverride = ""; }
    const base = adminBaseUrl(secrets.get("CHALLENGE_API_BASE_URL"), adminOverride);
    const result = await fetchAdminChallengeApi(action, body.params, key, base);
    const status = result.ok === false ? (result.status && result.status >= 400 ? result.status : 400) : 200;
    delete result.status;
    return Response.json(result, { status });
  } catch (error) {
    return Response.json({ ok: false, error: { code: "proxy_error", message: error.message } }, { status: 500 });
  }
}