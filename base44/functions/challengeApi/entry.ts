import { secrets } from "base44:runtime";
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { challengeIdFromBody, logEvent } from "../../shared/complianceGateHelper.ts";
import { isEntryBlocked, isVoteBlocked } from "../../shared/lifecycleGateHelper.ts";
import { signCustomSession } from "../../shared/customSession.ts";

const DEFAULT_BASE = "https://base44.app/api/apps/69341410f89d26a8fc73a4d1/functions/publicChallengeApi";
const GET_ACTIONS = new Set(["challenges", "entries", "votes", "classes"]);
const GET_PARAMS = [
  "id", "challenge_id", "status", "limit", "category", "division", "state",
  "phase", "sort", "page", "offset", "include_inactive", "user_email",
  "featured", "stage", "season",
];

// Write actions this app proxies upstream that must be gated by the interim
// compliance gate (Prompt 13). publish_challenge / update_challenge are listed
// defensively — they are not currently used by the frontend, but if they ever
// appear they are gated too.
const GATED_WRITE_ACTIONS = new Set([
  "submit_entry", "cast_vote", "publish_challenge", "update_challenge",
]);

// Public-facing filter: the upstream keyed endpoint returns draft/archived/
// deleted challenges too. Anonymous callers must only see active/voting/
// completed challenges, so we filter server-side here.
const BLOCKED_STATUSES = new Set(["draft", "archived", "deleted"]);
function isPublicChallengeStatus(c: any): boolean {
  const s = String(c?.status || "").toLowerCase().trim();
  return !BLOCKED_STATUSES.has(s);
}

export default async function (req) {
  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action;
    if (!action) return Response.json({ error: "Missing action" }, { status: 400 });

    const key = secrets.get("CHALLENGE_API_KEY");
    if (!key) return Response.json({ error: "CHALLENGE_API_KEY secret not set" }, { status: 500 });
    const BASE = secrets.get("CHALLENGE_API_BASE_URL") || DEFAULT_BASE;

    // The upstream publicChallengeApi does not yet expose a dedicated categories
    // endpoint — derive the active category list from live challenge data so the
    // frontend uses real categories, not a hardcoded list. Falls back to the
    // upstream ?action=categories automatically once it is deployed.
    if (action === "categories") {
      const catParams = new URLSearchParams({ action: "categories" });
      if (body.include_inactive) catParams.set("include_inactive", "true");
      const catResp = await fetch(`${BASE}?${catParams.toString()}`, { headers: { "x-api-key": key } });
      if (catResp.ok) {
        const catText = await catResp.text();
        return new Response(catText, { status: 200, headers: { "Content-Type": "application/json" } });
      }
      // Upstream doesn't support categories yet — derive from challenge data.
      const chParams = new URLSearchParams({ action: "challenges", limit: "500" });
      const chResp = await fetch(`${BASE}?${chParams.toString()}`, { headers: { "x-api-key": key } });
      const chData = await chResp.json().catch(() => ({}));
      const challenges = chData.challenges || [];
      const seen = new Map();
      for (const c of challenges) {
        const raw = String(c.category || "").trim();
        if (!raw) continue;
        const norm = raw.toLowerCase().replace(/_/g, "-");
        if (!seen.has(norm)) seen.set(norm, { raw, image: c.cover_image || "" });
      }
      const categories = Array.from(seen.entries()).map(([slug, { raw, image }], i) => ({
        key: slug.replace(/-/g, "_"),
        label: raw.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase()),
        description: "",
        image_url: image,
        sort_order: i,
        is_active: true,
      }));
      return Response.json({ categories, count: categories.length });
    }

    // Dashboard overview totals. The client used to invoke this function once
    // per challenge to sum entry counts, which tripped the platform rate limit.
    // The same per-challenge sum is now computed here in ONE request.
    if (action === "entry_totals") {
      const chResp = await fetch(
        `${BASE}?${new URLSearchParams({ action: "challenges", limit: "500" }).toString()}`,
        { headers: { "x-api-key": key } }
      );
      const chData = await chResp.json().catch(() => ({}));
      const challenges = chData.challenges || [];
      let entries = 0;
      // Small concurrency window — same upstream calls, one client request.
      for (let i = 0; i < challenges.length; i += 6) {
        const counts = await Promise.all(
          challenges.slice(i, i + 6).map(async (c) => {
            try {
              const r = await fetch(
                `${BASE}?${new URLSearchParams({ action: "entries", challenge_id: String(c.id) }).toString()}`,
                { headers: { "x-api-key": key } }
              );
              const d = await r.json().catch(() => ({}));
              return (d.entries || []).length;
            } catch {
              return 0;
            }
          })
        );
        entries += counts.reduce((a, b) => a + b, 0);
      }
      return Response.json({ challenges: challenges.length, entries });
    }

    // ── Password reset ────────────────────────────────────────────────
    // The parent app exposes a dedicated public `forgotPassword` function
    // (request / verify / reset) — a sibling of publicChallengeApi, not an
    // action on it. Map our action names onto its contract.
    const RESET_ACTIONS: Record<string, string> = {
      forgot_password: "request",
      verify_reset: "verify",
      reset_password: "reset",
    };
    if (RESET_ACTIONS[action]) {
      const resetUrl = BASE.replace(/\/[^/]+$/, "/forgotPassword");
      const payload: Record<string, unknown> = { action: RESET_ACTIONS[action] };
      if (action === "forgot_password") payload.email = body.email;
      if (action === "verify_reset") payload.token = body.token;
      if (action === "reset_password") {
        payload.token = body.token;
        payload.newPassword = body.new_password || body.newPassword;
      }
      const resetResp = await fetch(resetUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const resetText = await resetResp.text();
      return new Response(resetText, {
        status: resetResp.status,
        headers: { "Content-Type": "application/json" },
      });
    }

    // entries action: gate on the parent challenge's status — draft/archived/
    // deleted challenges must not expose their entries to anonymous callers.
    if (action === "entries") {
      const cid = body.challenge_id || body.id;
      if (cid) {
        const chParams = new URLSearchParams({ action: "challenges", id: String(cid) });
        const chResp = await fetch(`${BASE}?${chParams.toString()}`, { headers: { "x-api-key": key } });
        const chData = await chResp.json().catch(() => ({}));
        const ch = Array.isArray(chData.challenges) ? chData.challenges[0] : chData.challenge;
        if (ch && !isPublicChallengeStatus(ch)) {
          return Response.json({ entries: [], count: 0 });
        }
      }
    }

    let upstream;
    if (GET_ACTIONS.has(action)) {
      const params = new URLSearchParams({ action });
      for (const k of GET_PARAMS) {
        if (body[k] !== undefined && body[k] !== null && body[k] !== "") {
          params.set(k, String(body[k]));
        }
      }
      // Force status=active for the challenges action at the upstream call
      // level so the upstream pre-filters draft/archived/deleted challenges
      // out itself. The post-response filter below is a belt-and-suspenders
      // backup, but the upstream pre-filter is the primary defense — it
      // works even on deployed versions where the post-response filter
      // hasn't taken effect yet. Override any blocked status the caller
      // might send, and strip include_inactive so inactive challenges never
      // leak to the public proxy (admins use challengeEngine for that).
      if (action === "challenges") {
        const status = (params.get("status") || "").toLowerCase().trim();
        if (!status || BLOCKED_STATUSES.has(status)) {
          params.set("status", "active");
        }
        params.delete("include_inactive");
      }
      upstream = await fetch(`${BASE}?${params.toString()}`, {
        headers: { "x-api-key": key },
      });
    } else {
      // ── Interim compliance gate (Prompt 13) ───────────────────────────
      // Reject any gated write BEFORE it is forwarded upstream. This is the
      // server-side containment layer: even if a client bypasses the UI
      // hiding, this proxy refuses to forward the request.
      if (GATED_WRITE_ACTIONS.has(action)) {
        const challenge_id = challengeIdFromBody(body);
        if (challenge_id) {
          const sr = createClientFromRequest(req).asServiceRole;
          const blocked = action === "cast_vote"
            ? await isVoteBlocked(sr, challenge_id)
            : await isEntryBlocked(sr, challenge_id);
          if (blocked) {
            try {
              await logEvent(sr, {
                gate_id: "", challenge_id,
                action: "enforcement_block",
                field_name: action,
                note: `challengeApi proxy blocked a '${action}' for launch-blocked challenge.`,
              });
            } catch {}
            return Response.json(
              { error: "This challenge is temporarily blocked pending legal/compliance review." },
              { status: 403 }
            );
          }
        }
      }

      // For google_login, validate the Google access token directly via
      // Google's userinfo endpoint and return a session user. This bypasses
      // the upstream Challenge API's google_login action, which validates
      // the token against a different (hardcoded) Google client ID.
      if (action === "google_login" && body.access_token) {
        try {
          const userInfoResp = await fetch(
            "https://www.googleapis.com/oauth2/v3/userinfo",
            { headers: { Authorization: `Bearer ${body.access_token}` } }
          );
          if (!userInfoResp.ok) {
            return Response.json(
              { success: false, error: "Invalid Google login token" },
              { status: 401 }
            );
          }
          const gUser = await userInfoResp.json();
          if (!gUser.email) {
            return Response.json(
              { success: false, error: "Google account has no email" },
              { status: 400 }
            );
          }
          const gSessionUser = {
            id: gUser.sub,
            email: gUser.email,
            full_name: gUser.name || gUser.given_name || gUser.email.split("@")[0],
            role: "user",
          };
          return Response.json({
            success: true,
            user: gSessionUser,
            // Server-signed proof of identity for backend functions.
            session_token: await signCustomSession(gSessionUser, key),
          });
        } catch (e) {
          return Response.json(
            { success: false, error: "Google login failed: " + e.message },
            { status: 500 }
          );
        }
      }

      upstream = await fetch(BASE, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": key },
        body: JSON.stringify(body),
      });
    }

    let text = await upstream.text();

    // Filter draft/archived/deleted challenges from the public "challenges"
    // response (includes single-challenge "get" via action=challenges&id=).
    // This is the belt-and-suspenders backup to the upstream status=active
    // pre-filter above — if both run, the result is the same.
    if (action === "challenges" && upstream.ok) {
      try {
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed.challenges)) {
          parsed.challenges = parsed.challenges.filter(isPublicChallengeStatus);
          if ("count" in parsed) parsed.count = parsed.challenges.length;
          parsed._filter = "v2";
          text = JSON.stringify(parsed);
        }
        if (parsed.challenge && !isPublicChallengeStatus(parsed.challenge)) {
          text = JSON.stringify({ challenges: [], count: 0, _filter: "v2" });
        }
      } catch {}
    }

    // If GOOGLE_CLIENT_ID secret is set, override the client ID returned by
    // the upstream Challenge API so this app controls its own Google OAuth
    // credentials.
    // Successful custom (Challenge-API) login → attach a server-signed session
    // token so backend functions can derive identity without trusting the client.
    if (action === "login" && upstream.ok) {
      try {
        const parsed = JSON.parse(text);
        if (parsed?.success && parsed?.user?.email) {
          parsed.session_token = await signCustomSession(parsed.user, key);
          text = JSON.stringify(parsed);
        }
      } catch {}
    }

    const googleClientId = secrets.get("GOOGLE_CLIENT_ID");
    if (googleClientId && action === "google_config") {
      try {
        const parsed = JSON.parse(text);
        parsed.clientId = googleClientId;
        text = JSON.stringify(parsed);
      } catch {}
    }

    return new Response(text, {
      status: upstream.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}