import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { entryListQuery, isPubliclyListableEntry } from "../../shared/entryVisibility.ts";
import { fetchChallengeApi } from "../../shared/challengeApiHelper.ts";
import { secrets } from "base44:runtime";

// Challenge Engine — challenges live ONLY in the main app's public Challenge
// API. Nothing about a challenge is stored in this app's database.
//
//   action: 'list'   → challenges from the main app
//   action: 'get'    → { id }
//   action: 'create' → { data } create the challenge in the main app  (admin)
//
// Entry moderation still works on this app's own Entry records.
const STATUSES = ["draft", "active", "voting", "completed", "archived"];

function creds() {
  return {
    apiKey: secrets.get("CHALLENGE_API_KEY"),
    baseUrl: secrets.get("CHALLENGE_API_BASE_URL"),
  };
}

const day = (v) => (v ? String(v).slice(0, 10) : "");

// Map the admin form onto the API's create_challenge payload.
function toCreatePayload(d) {
  return {
    theme: d.theme || d.title || "",
    title: d.title || d.theme || "",
    description: d.brief || d.description || "",
    start_date: day(d.starts_at),
    end_date: day(d.submission_ends_at),
    voting_end_date: day(d.voting_ends_at) || undefined,
    category: d.category || undefined,
    state: d.state || undefined,
    season: d.season || undefined,
    stage: d.stage || "state",
    status: STATUSES.includes(d.status) ? d.status : "draft",
    cover_image: d.cover_image || undefined,
    age_divisions: d.divisions?.length ? d.divisions : undefined,
    content_type: d.content_type === "host_managed" ? "host_managed" : "admin_managed",
  };
}

// Actions that must work for logged-out visitors. Everything else
// requires a signed-in user; write actions additionally require an admin.
// entries is already filtered to approved-only for non-admins by entryListQuery.
const PUBLIC_ACTIONS = new Set(["list", "get", "entries"]);

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);

    const body = await req.json().catch(() => ({}));
    const action = body.action;
    if (!user && !PUBLIC_ACTIONS.has(action)) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    const sr = base44.asServiceRole;
    const isAdmin = user?.role === "admin" || user?.is_admin === true;
    const { apiKey, baseUrl } = creds();

    if (action === "list") {
      const res = await fetchChallengeApi(
        "challenges",
        { limit: 200, include_inactive: true },
        apiKey,
        baseUrl,
      );
      const list = Array.isArray(res) ? res : (res?.challenges || []);
      return Response.json({ challenges: list });
    }

    if (action === "get") {
      const id = String(body.id || "");
      if (!id) return Response.json({ error: "id required" }, { status: 400 });
      const res = await fetchChallengeApi("challenges", { id, include_inactive: true }, apiKey, baseUrl);
      const list = Array.isArray(res) ? res : (res?.challenges || (res?.challenge ? [res.challenge] : []));
      return Response.json({ challenge: list.find((c) => String(c.id) === id) || list[0] || null });
    }

    if (action === "create") {
      if (!isAdmin) return Response.json({ error: "Admin only" }, { status: 403 });
      const payload = toCreatePayload(body.data || {});
      if (!payload.theme || !payload.description || !payload.start_date || !payload.end_date) {
        return Response.json(
          { error: "Title, brief, start date and submissions close date are required." },
          { status: 400 },
        );
      }
      const res = await fetchChallengeApi("create_challenge", payload, apiKey, baseUrl);
      if (!res?.success || !res?.id) {
        return Response.json(
          { error: res?.error || res?.message || "The main app rejected this challenge." },
          { status: 400 },
        );
      }
      return Response.json({ challenge: res.challenge || { ...payload, id: res.id } });
    }

    if (action === "entries") {
      const challenge_id = String(body.challenge_id || "");
      if (!challenge_id) return Response.json({ error: "challenge_id required" }, { status: 400 });
      const entries = await sr.entities.Entry.filter(
        entryListQuery(challenge_id, isAdmin), "-created_date", 500
      ).catch(() => []);
      // Never expose entrant email addresses to clients.
      // Public lists also drop unguarded minors / children / teens.
      const visible = isAdmin
        ? (entries || [])
        : (entries || []).filter(isPubliclyListableEntry);
      // Live per-entry vote counts from the Vote entity — the single source of
      // truth used by the challenge detail page. Embedding them here ensures
      // every consumer (cards, banner, detail) shows the same numbers without
      // relying on a second round-trip to challengeVotes.
      const votes = await sr.entities.Vote.filter({ challenge_id }, '-created_date', 100000).catch(() => []);
      const counts: Record<string, number> = {};
      for (const v of (votes || [])) {
        if (v.excluded) continue;
        counts[v.entry_id] = (counts[v.entry_id] || 0) + 1;
      }
      const safe = visible.map(({ creator_email, ...rest }) => ({
        ...rest,
        vote_count: counts[rest.id] ?? rest.vote_count ?? 0,
      }));
      return Response.json({ entries: safe });
    }

    if (action === "moderate_entry") {
      if (!isAdmin) return Response.json({ error: "Admin only" }, { status: 403 });
      const entry_id = String(body.entry_id || "");
      const status = String(body.status || "");
      if (!entry_id || !["approved", "rejected", "pending"].includes(status)) {
        return Response.json({ error: "entry_id and a valid status are required" }, { status: 400 });
      }
      if (status === "approved") {
        const existing = await sr.entities.Entry.get(entry_id).catch(() => null);
        if (!existing) return Response.json({ error: "Entry no longer exists" }, { status: 404 });
        const kids = existing.is_minor === true ||
          ["children", "teens"].includes(String(existing.division || "").toLowerCase());
        if (kids && String(existing.guardian_approval_status || "") !== "approved") {
          return Response.json({
            error: "Cannot approve a children/teens or minor entry until guardian_approval_status is approved.",
          }, { status: 403 });
        }
      }
      const updated = await sr.entities.Entry.update(entry_id, {
        status,
        moderated_at: new Date().toISOString(),
        moderation_batch_id: `single-${Date.now()}`,
      });
      const { creator_email, ...safe } = updated || {};
      return Response.json({ ok: true, entry: safe });
    }

    if (action === "moderate_entries") {
      if (!isAdmin) return Response.json({ error: "Admin only" }, { status: 403 });
      const ids = Array.isArray(body.entry_ids) ? body.entry_ids.map(String).filter(Boolean) : [];
      const status = String(body.status || "");
      if (!ids.length || !["approved", "rejected", "pending"].includes(status)) {
        return Response.json({ error: "entry_ids and a valid status are required" }, { status: 400 });
      }
      const results = [];
      const batchId = `batch-${Date.now()}`;
      const moderatedAt = new Date().toISOString();
      for (const entry_id of ids) {
        try {
          const existing = await sr.entities.Entry.get(entry_id);
          if (!existing) {
            results.push({ entry_id, ok: false, error: "Entry no longer exists" });
            continue;
          }
          if (existing.status === status) {
            results.push({ entry_id, ok: false, skipped: true, error: `Already ${status}` });
            continue;
          }
          if (status === "approved") {
            const kids = existing.is_minor === true ||
              ["children", "teens"].includes(String(existing.division || "").toLowerCase());
            if (kids && String(existing.guardian_approval_status || "") !== "approved") {
              results.push({
                entry_id,
                ok: false,
                error: "Cannot approve until guardian_approval_status is approved",
              });
              continue;
            }
          }
          await sr.entities.Entry.update(entry_id, { status, moderated_at: moderatedAt, moderation_batch_id: batchId });
          results.push({ entry_id, ok: true, status });
        } catch (e) {
          results.push({ entry_id, ok: false, error: e.message || "Update failed" });
        }
      }
      return Response.json({
        ok: true,
        results,
        succeeded: results.filter((r) => r.ok).length,
        failed: results.filter((r) => !r.ok).length,
      });
    }

    return Response.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}