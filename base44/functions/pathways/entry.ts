import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";
import { secrets } from "base44:runtime";

const DEFAULT_BASE = "https://base44.app/api/apps/69341410f89d26a8fc73a4d1/functions/publicChallengeApi";
const TYPES = new Set(["national_state_ranking", "state_to_national", "local_to_state_to_national", "series_championship", "private_organisation", "invitational"]);

function normEmail(e) { return (e || "").trim().toLowerCase(); }

async function fetchUpstreamEntries(challenge_id, apiKey, baseUrl) {
  if (!apiKey) return [];
  const BASE = baseUrl || DEFAULT_BASE;
  const params = new URLSearchParams({ action: "entries", challenge_id, limit: "500", sort: "-community_votes" });
  try {
    const r = await fetch(`${BASE}?${params.toString()}`, { headers: { "x-api-key": apiKey } });
    const d = await r.json();
    return d.entries || [];
  } catch { return []; }
}

export default async function (req) {
  try {
    const body = await req.json().catch(() => ({}));
    const { action } = body;
    if (!action) return Response.json({ error: "Missing action" }, { status: 400 });

    const base44 = createClientFromRequest(req);
    const sr = base44.asServiceRole;
    const user = await base44.auth.me().catch(() => null);
    const isAdmin = user?.role === "admin";
    const now = new Date().toISOString();
    const apiKey = secrets.get("CHALLENGE_API_KEY");
    const apiBase = secrets.get("CHALLENGE_API_BASE_URL") || DEFAULT_BASE;

    // ---- Admin-only management ----
    if (action === "list") {
      if (!isAdmin) return Response.json({ error: "Admin only" }, { status: 403 });
      const [pathways, members] = await Promise.all([
        sr.entities.Pathway.list("-created_date", 200),
        sr.entities.PathwayMember.list("-created_date", 500),
      ]);
      return Response.json({ pathways: pathways || [], members: members || [] });
    }

    if (action === "save_pathway") {
      if (!isAdmin) return Response.json({ error: "Admin only" }, { status: 403 });
      const p = body.pathway;
      if (!p || !p.name || !p.type || !TYPES.has(p.type)) return Response.json({ error: "Invalid pathway" }, { status: 400 });
      const clean = {
        name: String(p.name).slice(0, 120),
        type: p.type,
        description: String(p.description || "").slice(0, 1000),
        season_label: String(p.season_label || "").slice(0, 80),
        anchor_challenge_id: String(p.anchor_challenge_id || ""),
        access_code: String(p.access_code || "").slice(0, 60),
        approved_organisations: Array.isArray(p.approved_organisations) ? p.approved_organisations.map((o) => String(o).slice(0, 120)) : [],
        invited_emails: Array.isArray(p.invited_emails) ? p.invited_emails.map((e) => normEmail(e)).filter(Boolean) : [],
        points_scale: Array.isArray(p.points_scale) && p.points_scale.length ? p.points_scale.map(Number) : [10, 8, 6, 5, 4, 3, 2, 1],
        promotion_count: Math.max(1, Math.min(20, Number(p.promotion_count) || 3)),
        status: ["draft", "active", "archived"].includes(p.status) ? p.status : "draft",
      };
      let saved;
      if (p.id) saved = await sr.entities.Pathway.update(p.id, clean);
      else saved = await sr.entities.Pathway.create(clean);
      return Response.json({ pathway: saved });
    }

    if (action === "delete_pathway") {
      if (!isAdmin) return Response.json({ error: "Admin only" }, { status: 403 });
      const { pathway_id } = body;
      if (!pathway_id) return Response.json({ error: "Missing pathway_id" }, { status: 400 });
      const members = await sr.entities.PathwayMember.filter({ pathway_id }, "-created_date", 500);
      await Promise.all((members || []).map((m) => sr.entities.PathwayMember.delete(m.id).catch(() => {})));
      await sr.entities.Promotion.deleteMany({ pathway_id }).catch(() => {});
      await sr.entities.SeriesStanding.deleteMany({ pathway_id }).catch(() => {});
      await sr.entities.Pathway.delete(pathway_id).catch(() => {});
      return Response.json({ ok: true });
    }

    if (action === "save_member") {
      if (!isAdmin) return Response.json({ error: "Admin only" }, { status: 403 });
      const m = body.member;
      if (!m || !m.pathway_id || !m.challenge_id || !m.member_kind) return Response.json({ error: "Invalid member" }, { status: 400 });
      const clean = {
        pathway_id: m.pathway_id,
        challenge_id: m.challenge_id,
        challenge_title: String(m.challenge_title || "").slice(0, 160),
        member_kind: m.member_kind,
        region: String(m.region || "").slice(0, 80),
        tier: Number(m.tier) || 1,
        promotion_to_challenge_id: String(m.promotion_to_challenge_id || ""),
        promotion_count_override: Math.max(0, Math.min(20, Number(m.promotion_count_override) || 0)),
        status: ["active", "archived"].includes(m.status) ? m.status : "active",
      };
      let saved;
      if (m.id) saved = await sr.entities.PathwayMember.update(m.id, clean);
      else saved = await sr.entities.PathwayMember.create(clean);
      return Response.json({ member: saved });
    }

    if (action === "remove_member") {
      if (!isAdmin) return Response.json({ error: "Admin only" }, { status: 403 });
      await sr.entities.PathwayMember.delete(body.member_id).catch(() => {});
      return Response.json({ ok: true });
    }

    // ---- Public gating config (for the submit form) ----
    if (action === "public_config") {
      const { challenge_id } = body;
      if (!challenge_id) return Response.json({ gated: false });
      const members = await sr.entities.PathwayMember.filter({ challenge_id, status: "active" }, "-created_date", 50);
      const ids = new Set((members || []).map((m) => m.pathway_id));
      // Also match anchor_challenge_id on the pathway itself.
      const pathways = await sr.entities.Pathway.list("-created_date", 200);
      const anchor = (pathways || []).find((p) => p.anchor_challenge_id === challenge_id && p.status !== "archived");
      if (anchor) ids.add(anchor.id);
      if (!ids.size) return Response.json({ gated: false });
      const ps = (pathways || []).filter((p) => ids.has(p.id) && p.status !== "archived");
      // First gated-type pathway wins.
      const gated = ps.find((p) => p.type === "private_organisation" || p.type === "invitational");
      if (!gated) return Response.json({ gated: false, pathway_type: ps[0]?.type });
      return Response.json({
        gated: true,
        pathway_id: gated.id,
        pathway_type: gated.type,
        pathway_name: gated.name,
        requires_org: gated.type === "private_organisation",
        requires_code: !!(gated.access_code || "").trim(),
        approved_organisations: gated.type === "private_organisation" ? (gated.approved_organisations || []) : [],
      });
    }

    // ---- Entry eligibility check (authed) ----
    if (action === "entry_check") {
      if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
      const { challenge_id, email, organisation, access_code } = body;
      if (!challenge_id) return Response.json({ allowed: true });
      const cfg = await (async () => {
        const members = await sr.entities.PathwayMember.filter({ challenge_id, status: "active" }, "-created_date", 50);
        const pathways = await sr.entities.Pathway.list("-created_date", 200);
        const ids = new Set((members || []).map((m) => m.pathway_id));
        const anchor = (pathways || []).find((p) => p.anchor_challenge_id === challenge_id && p.status !== "archived");
        if (anchor) ids.add(anchor.id);
        return (pathways || []).filter((p) => ids.has(p.id) && p.status !== "archived");
      })();
      const gated = cfg.find((p) => p.type === "private_organisation" || p.type === "invitational");
      if (!gated) return Response.json({ allowed: true });
      const e = normEmail(email || user.email);
      if (gated.type === "invitational") {
        const invited = (gated.invited_emails || []).map(normEmail);
        const code = String(access_code || "").trim();
        if (invited.includes(e) || (gated.access_code && code && code === gated.access_code)) {
          return Response.json({ allowed: true, pathway_id: gated.id });
        }
        return Response.json({ allowed: false, reason: "This is an invitation-only challenge. Your email isn't on the invite list." });
      }
      if (gated.type === "private_organisation") {
        const orgs = (gated.approved_organisations || []).map((o) => o.toLowerCase().trim());
        const org = String(organisation || "").toLowerCase().trim();
        const code = String(access_code || "").trim();
        if ((org && orgs.includes(org)) || (gated.access_code && code && code === gated.access_code)) {
          return Response.json({ allowed: true, pathway_id: gated.id });
        }
        return Response.json({ allowed: false, reason: "Entry is restricted to approved organisations. Check the organisation name or access code." });
      }
      return Response.json({ allowed: true });
    }

    // ---- Compute series standings from locked CombinedResults ----
    if (action === "compute_standings") {
      if (!isAdmin) return Response.json({ error: "Admin only" }, { status: 403 });
      const { pathway_id } = body;
      if (!pathway_id) return Response.json({ error: "Missing pathway_id" }, { status: 400 });
      const pathway = await sr.entities.Pathway.get(pathway_id).catch(() => null);
      if (!pathway) return Response.json({ error: "Pathway not found" }, { status: 404 });
      const members = await sr.entities.PathwayMember.filter({ pathway_id, status: "active" }, "-created_date", 200);
      const eventChallenges = (members || []).filter((m) => m.member_kind === "series_event" || m.member_kind === "qualifier" || m.member_kind === "anchor");
      // Gather per-event placings from CombinedResult (locked) for each event challenge.
      const agg = {};
      for (const m of eventChallenges) {
        const results = await sr.entities.CombinedResult.filter({ challenge_id: m.challenge_id }, "-combined_score", 200).catch(() => []);
        // Only count if the panel for this challenge is locked → results are final.
        const panel = await sr.entities.JudgingPanel.filter({ competition_id: m.challenge_id }, "-created_date", 1);
        const locked = (panel && panel[0]?.results_locked) || false;
        (results || []).forEach((r) => {
          if (!r.combined_rank || r.combined_rank < 1) return;
          const key = r.creator_name || r.entry_title || r.entry_id;
          if (!agg[key]) agg[key] = { creator_name: r.creator_name || "", creator_email: "", state: "", total_points: 0, events_counted: 0, best_placing: r.combined_rank, breakdown: [] };
          const scale = pathway.points_scale || [10, 8, 6, 5, 4, 3, 2, 1];
          const pts = scale[r.combined_rank - 1] || 0;
          if (pts > 0) {
            agg[key].total_points += pts;
            agg[key].events_counted += 1;
            if (r.combined_rank < agg[key].best_placing) agg[key].best_placing = r.combined_rank;
            agg[key].breakdown.push({ challenge_id: m.challenge_id, challenge_title: m.challenge_title, placing: r.combined_rank, points: pts });
          }
          if (locked && !agg[key]._lockedSeen) agg[key]._lockedSeen = true;
        });
      }
      const rows = Object.values(agg).map((r) => {
        const { creator_name, creator_email, state, total_points, events_counted, best_placing, breakdown } = r;
        return { creator_name, creator_email, state, total_points, events_counted, best_placing, breakdown };
      });
      rows.sort((a, b) => b.total_points - a.total_points || a.best_placing - b.best_placing);
      rows.forEach((r, i) => { r.rank = i + 1; });
      // Persist: clear old, create new.
      await sr.entities.SeriesStanding.deleteMany({ pathway_id }).catch(() => {});
      let saved = [];
      if (rows.length) saved = await sr.entities.SeriesStanding.bulkCreate(rows.map((r) => ({ ...r, pathway_id, computed_at: now })));
      const champion = rows[0] ? { rank: 1, creator_name: rows[0].creator_name, total_points: rows[0].total_points } : null;
      return Response.json({ standings: saved || [], champion });
    }

    if (action === "promote_winners") {
      if (!isAdmin) return Response.json({ error: "Admin only" }, { status: 403 });
      const { from_challenge_id } = body;
      if (!from_challenge_id) return Response.json({ error: "Missing from_challenge_id" }, { status: 400 });
      const members = await sr.entities.PathwayMember.filter({ challenge_id: from_challenge_id, status: "active" }, "-created_date", 50);
      const member = (members || []).find((m) => m.promotion_to_challenge_id);
      if (!member) return Response.json({ error: "This challenge isn't a qualifier with a promotion target." }, { status: 400 });
      const pathway = await sr.entities.Pathway.get(member.pathway_id).catch(() => null);
      if (!pathway) return Response.json({ error: "Pathway not found" }, { status: 404 });
      const promoteN = member.promotion_count_override > 0 ? member.promotion_count_override : (pathway.promotion_count || 3);

      // Rank source entries: prefer locked CombinedResult; fall back to upstream votes.
      let ranked = await sr.entities.CombinedResult.filter({ challenge_id: from_challenge_id }, "-combined_score", 200).catch(() => []);
      ranked = (ranked || []).filter((r) => r.combined_rank > 0).sort((a, b) => a.combined_rank - b.combined_rank);
      let sourceEntries = [];
      if (ranked.length) {
        const ids = ranked.map((r) => r.entry_id);
        // Pull full entry data from upstream to copy fields.
        const up = await fetchUpstreamEntries(from_challenge_id, apiKey, apiBase);
        const byId = {};
        up.forEach((e) => { byId[String(e.id)] = e; });
        // Native entries may hold the guardian gate when the source is local.
        const nativeById = {};
        for (const id of ids) {
          const local = await sr.entities.Entry.get(String(id)).catch(() => null);
          if (local) nativeById[String(id)] = local;
        }
        sourceEntries = ranked.map((r) => {
          const e = byId[String(r.entry_id)] || nativeById[String(r.entry_id)] || {};
          const local = nativeById[String(r.entry_id)] || {};
          return {
            entry_id: r.entry_id,
            title: r.entry_title || e?.title || local.title || "",
            creator_name: r.creator_name || e?.creator_name || local.creator_name || "",
            state: e?.state || local.state || "",
            city: e?.city || local.city || "",
            division: e?.division || local.division || "adults",
            work_type: (e?.work_type || local.work_type) === "link" ? "link" : "text",
            work_text: e?.work_text || e?.description || local.work_text || "",
            work_link: e?.work_link || e?.work_url || local.work_link || "",
            category: e?.category || local.category || "",
            is_minor: !!(e?.is_minor ?? local.is_minor),
            guardian_approval_status: String(
              local.guardian_approval_status || e?.guardian_approval_status || ""
            ),
            placing: r.combined_rank,
          };
        });
      } else {
        const up = await fetchUpstreamEntries(from_challenge_id, apiKey, apiBase);
        sourceEntries = up.map((e, i) => ({
          entry_id: String(e.id),
          title: e.title || "",
          creator_name: e.creator_name || "",
          state: e.state || "",
          city: e.city || "",
          division: e.division || "adults",
          work_type: e.work_type === "link" ? "link" : "text",
          work_text: e.work_text || e.description || "",
          work_link: e.work_link || e.work_url || "",
          category: e.category || "",
          is_minor: !!e.is_minor,
          guardian_approval_status: String(e.guardian_approval_status || ""),
          placing: i + 1,
        }));
      }

      const targetId = member.promotion_to_challenge_id;
      const promoted = [];
      const skipped = [];
      for (const src of sourceEntries) {
        if (promoted.length >= promoteN) break;
        // Kids freeze: never promote minors / children / teens without an
        // explicit approved guardian decision AND a granted GuardianConsent.
        const kidsDiv = ["children", "teens"].includes(String(src.division || "").toLowerCase());
        const isKids = !!(src.is_minor || kidsDiv);
        if (isKids && src.guardian_approval_status !== "approved") {
          skipped.push({
            entry_id: src.entry_id,
            reason: `guardian_approval_status is '${src.guardian_approval_status || "empty"}' — kids/teens cannot promote without approved guardian consent.`,
          });
          continue;
        }
        let sourceConsent = null;
        if (isKids) {
          const srcConsents = await sr.entities.GuardianConsent.filter(
            { entry_id: String(src.entry_id), status: "granted" }, "-created_date", 1
          ).catch(() => []);
          sourceConsent = (srcConsents && srcConsents[0]) || null;
          if (!sourceConsent) {
            skipped.push({
              entry_id: src.entry_id,
              reason: "no granted GuardianConsent on source entry — kids/teens cannot promote.",
            });
            continue;
          }
        }
        // Idempotency: skip if already promoted from this source entry.
        const existing = await sr.entities.Promotion.filter({ from_challenge_id, source_entry_id: src.entry_id }, "-created_date", 1);
        if (existing && existing[0]?.status === "promoted") { skipped.push({ entry_id: src.entry_id, reason: "already promoted" }); continue; }
        // Idempotency on the target: skip if a local Entry already exists for this source.
        const existingTarget = await sr.entities.Entry.filter({ challenge_id: targetId, upstream_entry_id: src.entry_id }, "-created_date", 1);
        let entryId = existingTarget?.[0]?.id;
        if (entryId) {
          const existingKids = existingTarget[0].is_minor || ["children", "teens"].includes(String(existingTarget[0].division || "").toLowerCase());
          if (existingKids && String(existingTarget[0].guardian_approval_status || "") !== "approved") {
            skipped.push({
              entry_id: src.entry_id,
              reason: "target entry exists but guardian_approval_status is not approved — kids/teens cannot promote.",
            });
            continue;
          }
          if (existingKids) {
            const tgtConsents = await sr.entities.GuardianConsent.filter(
              { entry_id: String(entryId), status: "granted" }, "-created_date", 1
            ).catch(() => []);
            if (!tgtConsents || !tgtConsents.length) {
              skipped.push({
                entry_id: src.entry_id,
                reason: "target entry missing granted GuardianConsent for entry_id — refuse reuse.",
              });
              continue;
            }
          }
        }
        if (!entryId) {
          // Fail-closed: never create kids with approved+valid until GuardianConsent exists for the new entry_id.
          const created = await sr.entities.Entry.create({
            challenge_id: targetId,
            title: src.title,
            description: "",
            creator_name: src.creator_name,
            creator_email_masked: "",
            state: src.state,
            city: src.city,
            division: src.division,
            work_type: src.work_type,
            work_text: src.work_text,
            work_link: src.work_link,
            status: "approved",
            is_minor: src.is_minor,
            guardian_approval_status: isKids ? "pending" : "not_required",
            consent_status: isKids ? "pending_consent" : "valid",
            upstream_entry_id: src.entry_id,
            category: src.category,
            challenge_title: member.challenge_title || "",
          });
          entryId = created.id;
          if (isKids) {
            await sr.entities.GuardianConsent.create({
              challenge_id: targetId,
              entry_id: String(entryId),
              participant_name: sourceConsent.participant_name || src.creator_name || "participant",
              participant_email: sourceConsent.participant_email || "",
              requirement_id: sourceConsent.requirement_id || "pathway_promote",
              requirement_version: sourceConsent.requirement_version || 1,
              guardian_name: sourceConsent.guardian_name || "guardian",
              guardian_relationship: sourceConsent.guardian_relationship || "",
              guardian_contact: sourceConsent.guardian_contact || "",
              method_used: sourceConsent.method_used || "guardian_account_countersign",
              verified_at: sourceConsent.verified_at || now,
              status: "granted",
              scopes_entering_challenge: !!sourceConsent.scopes_entering_challenge,
              scopes_terms_acceptance: !!sourceConsent.scopes_terms_acceptance,
              scopes_personal_info_processing: !!sourceConsent.scopes_personal_info_processing,
              scopes_public_display_name: !!sourceConsent.scopes_public_display_name,
              scopes_public_display_age_bracket: !!sourceConsent.scopes_public_display_age_bracket,
              scopes_publication_of_entry_media: !!sourceConsent.scopes_publication_of_entry_media,
              scopes_promotional_reuse: !!sourceConsent.scopes_promotional_reuse,
              scopes_direct_communication_with_minor: !!sourceConsent.scopes_direct_communication_with_minor,
              scopes_public_voting_participation: !!sourceConsent.scopes_public_voting_participation,
              scopes_prize_acceptance_payment: !!sourceConsent.scopes_prize_acceptance_payment,
              scopes_event_travel_attendance: !!sourceConsent.scopes_event_travel_attendance,
              scopes_appears_in_entry: !!sourceConsent.scopes_appears_in_entry,
              consent_wording_hash: sourceConsent.consent_wording_hash || "",
            });
            await sr.entities.Entry.update(entryId, {
              guardian_approval_status: "approved",
              consent_status: "valid",
            });
          }
        }
        if (existing && existing[0]) {
          await sr.entities.Promotion.update(existing[0].id, { status: "promoted", promoted_entry_id: entryId, promoted_at: now, region: src.state, placing: src.placing, creator_name: src.creator_name });
        } else {
          await sr.entities.Promotion.create({
            pathway_id: member.pathway_id,
            from_challenge_id,
            to_challenge_id: targetId,
            source_entry_id: src.entry_id,
            promoted_entry_id: entryId,
            creator_name: src.creator_name,
            region: src.state,
            placing: src.placing,
            promoted_at: now,
            status: "promoted",
          });
        }
        promoted.push({ source_entry_id: src.entry_id, promoted_entry_id: entryId, placing: src.placing, creator_name: src.creator_name });
      }
      return Response.json({ promoted, skipped, promote_n: promoteN });
    }

    return Response.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    return Response.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}