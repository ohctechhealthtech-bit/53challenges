import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { secrets } from "base44:runtime";
import { fetchChallengeApi } from "../../shared/challengeApiHelper.ts";
import {
  UPDATABLE_FIELDS, canClearLaunchBlocked, unmetConditions,
  evaluateClearance, logEvent, createGate,
} from "../../shared/complianceGateHelper.ts";
import { hasPassedReviewToApproved } from "../../shared/lifecycleGateHelper.ts";

// Interim Legal Gate (Prompt 13) admin function.
//   action: 'list'     -> all gates                                   (admin)
//   action: 'get'      -> { challenge_id } gate or null               (admin)
//   action: 'update'   -> { gate_id, fields } enforced + audit-logged (admin)
//   action: 'sync'     -> ensure a gate for every upstream challenge  (admin)
//   action: 'audit'    -> { gate_id } audit log                        (admin)
//   action: 'statuses'  -> { challenge_ids: [] } { [id]: {launch_blocked, legal_review_status} } (any authed user — read-only, for UI)
// Actions that must work for logged-out visitors. Everything else
// requires a signed-in user; write actions additionally require an admin.
// statuses is read-only and only reports whether a challenge is launch-blocked.
const PUBLIC_ACTIONS = new Set(["statuses"]);

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

    // ── statuses: read-only, any authenticated user (UI annotation) ──
    if (action === "statuses") {
      const ids = [...new Set(
        (Array.isArray(body.challenge_ids) ? body.challenge_ids : []).filter(Boolean).map(String)
      )];
      const out = {};
      // Fail-closed: no gate on record means Enter/Vote stay blocked until an
      // admin creates and clears a ComplianceGate. Missing ≠ permitted.
      for (const id of ids) {
        out[id] = { launch_blocked: true, legal_review_status: "not_started", grandfathered_live: false };
      }
      if (ids.length) {
        // One batched query for all ids — a per-id loop hit the entity API
        // rate limit on catalogue loads.
        const gates = await sr.entities.ComplianceGate.filter(
          { challenge_id: { $in: ids } }, "-created_date", 1000
        );
        const seen = new Set();
        // Sorted newest-first, so the first gate seen per id is the current one.
        for (const g of gates || []) {
          const id = String(g.challenge_id || "");
          if (!(id in out) || seen.has(id)) continue;
          seen.add(id);
          out[id] = {
            launch_blocked: g.launch_blocked === true,
            legal_review_status: g.legal_review_status || "not_started",
            grandfathered_live: g.grandfathered_live === true,
          };
        }
      }
      return Response.json({ statuses: out });
    }

    // Everything below is admin-only.
    if (!isAdmin) return Response.json({ error: "Admin only" }, { status: 403 });

    if (action === "list") {
      const gates = await sr.entities.ComplianceGate.list("-updated_date", 500);
      return Response.json({ gates: gates || [] });
    }

    if (action === "get") {
      const challenge_id = String(body.challenge_id || "");
      if (!challenge_id) return Response.json({ error: "challenge_id required" }, { status: 400 });
      const g = await sr.entities.ComplianceGate.filter({ challenge_id }, "-created_date", 1);
      return Response.json({ gate: (g && g[0]) || null });
    }

    if (action === "audit") {
      const gate_id = String(body.gate_id || "");
      if (!gate_id) return Response.json({ error: "gate_id required" }, { status: 400 });
      const logs = await sr.entities.ComplianceGateLog.filter({ gate_id }, "-created_date", 200);
      return Response.json({ logs: logs || [] });
    }

    if (action === "sync") {
      const apiKey = secrets.get("CHALLENGE_API_KEY");
      const baseUrl = secrets.get("CHALLENGE_API_BASE_URL");
      if (!apiKey) return Response.json({ error: "CHALLENGE_API_KEY secret not set" }, { status: 500 });
      const data = await fetchChallengeApi("challenges", {}, apiKey, baseUrl);
      const upstream = data.challenges || [];
      let created = 0, skipped = 0, grandfathered = 0;
      for (const c of upstream) {
        const id = String(c.id || c._id || "");
        if (!id) { skipped++; continue; }
        const title = c.theme || c.title || "";
        // "live" = currently active AND in submission or voting phase.
        const status = String(c.status || "").toLowerCase();
        const now = Date.now();
        const subEnd = c.end_date || c.submission_ends_at;
        const voteEnd = c.voting_end_date || c.voting_ends_at;
        const inSubmit = subEnd && new Date(subEnd).getTime() > now;
        const inVote = !inSubmit && voteEnd && new Date(voteEnd).getTime() > now;
        const live = status === "active" && (inSubmit || inVote);
        const res = await createGate(sr, id, title, live, { id: user.id, email: user.email });
        if (res.created) { created++; if (live) grandfathered++; }
        else skipped++;
      }
      await logEvent(sr, {
        gate_id: "sync",
        challenge_id: "",
        action: "synced",
        changed_by_id: user.id,
        changed_by_email: user.email,
        note: `Synced ${created} new gates (${grandfathered} grandfathered live, ${skipped} already existed) from ${upstream.length} upstream challenges.`,
      });
      return Response.json({ sync: { total: upstream.length, created, grandfathered, skipped } });
    }

    if (action === "update") {
      const gate_id = String(body.gate_id || "");
      if (!gate_id) return Response.json({ error: "gate_id required" }, { status: 400 });
      const incoming = body.fields && typeof body.fields === "object" ? body.fields : {};
      // Only allow known updatable fields.
      const updates = {};
      for (const k of UPDATABLE_FIELDS) {
        if (incoming[k] !== undefined) updates[k] = incoming[k];
      }

      const existing = await sr.entities.ComplianceGate.filter({ id: gate_id }, "-created_date", 1);
      const gate = existing && existing[0];
      if (!gate) return Response.json({ error: "Gate not found" }, { status: 404 });

      // Prompt 17: once a challenge has passed the review_to_approved
      // lifecycle gate, the interim launch_blocked field is read-only /
      // historical — the lifecycle gate system is now the active enforcement
      // mechanism. Reject any launch_blocked change (either direction).
      if (updates.launch_blocked !== undefined) {
        const reviewPassed = await hasPassedReviewToApproved(sr, gate.challenge_id);
        if (reviewPassed) {
          return Response.json(
            { error: "launch_blocked is read-only/historical: the review_to_approved lifecycle gate has passed, so the interim gate no longer governs this challenge." },
            { status: 409 }
          );
        }
      }

      // Merge for rule evaluation.
      const merged = { ...gate, ...updates };

      // Rule: launch_blocked can only be set false when all conditions met.
      // (Prompt 15) also checks PromoterAppointment + VotingConfiguration
      // legal_opinion_reference via evaluateClearance (DB records).
      if (updates.launch_blocked === false && gate.launch_blocked === true) {
        if (!canClearLaunchBlocked(merged)) {
          const missing = unmetConditions(merged);
          return Response.json(
            { error: "Cannot clear launch_blocked: gate conditions not met.", missing },
            { status: 409 }
          );
        }
        const { canClear, missing: dbMissing } = await evaluateClearance(sr, merged);
        if (!canClear) {
          return Response.json(
            { error: "Cannot clear launch_blocked: promoter/voting conditions not met.", missing: dbMissing },
            { status: 409 }
          );
        }
      }

      // Record every changed field in the audit log.
      const actor = { id: user.id, email: user.email };
      for (const k of UPDATABLE_FIELDS) {
        if (updates[k] === undefined) continue;
        const oldVal = gate[k];
        const newVal = updates[k];
        const changed = JSON.stringify(oldVal) !== JSON.stringify(newVal);
        if (!changed) continue;
        await logEvent(sr, {
          gate_id, challenge_id: gate.challenge_id,
          action: k === "launch_blocked" ? (newVal ? "launch_blocked" : "launch_unblocked") : "field_change",
          field_name: k,
          old_value: oldVal, new_value: newVal,
          changed_by_id: actor.id, changed_by_email: actor.email,
          note: k === "launch_blocked" && newVal === false ? "Cleared after all conditions met." : "",
        });
      }

      await sr.entities.ComplianceGate.update(gate_id, updates);
      const refreshed = await sr.entities.ComplianceGate.filter({ id: gate_id }, "-created_date", 1);
      return Response.json({ gate: (refreshed && refreshed[0]) || { ...gate, ...updates } });
    }

    return Response.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}