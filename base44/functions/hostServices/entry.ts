import { secrets } from "base44:runtime";

// Proxy for the parent app's hostServicesApi — the add-on services shown in the
// host application wizard. Read-only from this app: only `list` and `get` are
// forwarded, and the API key never reaches the browser.
const DEFAULT_BASE = "https://base44.app/api/apps/69341410f89d26a8fc73a4d1/functions/hostServicesApi";
const ALLOWED = new Set(["list", "get"]);

export default async function (req) {
  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action || "list";
    if (!ALLOWED.has(action)) {
      return Response.json({ error: `Unsupported action: ${action}` }, { status: 400 });
    }

    const key = secrets.get("CHALLENGE_API_KEY");
    if (!key) return Response.json({ error: "CHALLENGE_API_KEY secret not set" }, { status: 500 });

    const configured = secrets.get("CHALLENGE_API_BASE_URL");
    const base = configured
      ? configured.replace(/\/[^/]*$/, "/hostServicesApi")
      : DEFAULT_BASE;

    const payload = { action, api_key: key };
    if (body.key) payload.key = body.key;
    if (body.id) payload.id = body.id;
    if (body.include_inactive) payload.include_inactive = true;

    const upstream = await fetch(base, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": key },
      body: JSON.stringify(payload),
    });
    const text = await upstream.text();
    return new Response(text, {
      status: upstream.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}