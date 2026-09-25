import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { secrets } from "base44:runtime";
import {
  GATE_CODES, evaluateGate, passGate, logGateEvaluation,
  challengePhase, grandfatheredGatesForPhase,
} from "../../shared/lifecycleGateHelper.ts";
import { recheckPermitFindings } from "../../shared/permitHelper.ts";
import { fetchChallengeApi } from "../../shared/challengeApiHelper.ts";

// Lifecycle Gates (Prompt 17) — backend function.
//
//   action: 'list_gates'    → all LifecycleGate reference data             (any authed)
//   action: 'gate_status'   → { challenge_id } all gate checks + eval       (any authed)
//   action: 'check_gate'    → { challenge_id, gate_code } evaluate + log   (any authed)
//   action: 'pass_gate'     → { challenge_id, gate_code } pass gate         (admin)
//   action: 'evaluate_all'  → evaluate every upstream challenge against the (admin)
//                             new gates; grandfather live challenges; log
//                             every evaluation. Does NOT republish or alter
//                             any challenge's live/public state.

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const action = body.action;
    const sr = base44.asServiceRole;
    const isAdmin = user.role === "admin" || user.is_admin === true;
    const actor = { id: user.id, email: user.email };

    // ── list_gates: reference data (any authed) ─────────────────────
    if (action === "list_gates") {
      const gates = await sr.entities.LifecycleGate.list("sort_order", 50);
      return Response.json({ gates: gates || [] });
    }

    // ── gate_status: all gates for a challenge (any authed) ──────────
    if (action === "gate_status") {
      const challenge_id = String(body.challenge_id || "");
      if (!challenge_id) return Response.json({ error: "challenge_id required" }, { status: 400 });

      await recheckPermitFindings(sr, challenge_id, actor);

      const gateDefs = await sr.entities.LifecycleGate.list("sort_order", 50);
      const checks = await sr.entities.GateCheck.filter(
        { challenge_id }, "-created_date", 50
      ).catch(() => []);
      const checksByCode = {};
      for (const c of checks || []) checksByCode[c.gate_code] = c;

      const out = [];
      for (const def of gateDefs || []) {
        const evalResult = await evaluateGate(sr, challenge_id, def.code, body.challenge_data);
        out.push({ ...def, check: checksByCode[def.code] || null, evaluation: evalResult });
      }
      return Response.json({ gates: out });
    }

    // ── check_gate: evaluate one gate + audit log (any authed) ───────
    if (action === "check_gate") {
      const challenge_id = String(body.challenge_id || "");
      const gate_code = String(body.gate_code || "");
      if (!challenge_id || !gate_code) {
        return Response.json({ error: "challenge_id and gate_code required" }, { status: 400 });
      }
      if (!GATE_CODES.includes(gate_code)) {
        return Response.json({ error: "Invalid gate_code" }, { status: 400 });
      }
      await recheckPermitFindings(sr, challenge_id, actor);
      const evalResult = await evaluateGate(sr, challenge_id, gate_code, body.challenge_data);
      await logGateEvaluation(sr, challenge_id, gate_code, evalResult, actor);
      return Response.json({ evaluation: evalResult });
    }

    // ── pass_gate: pass a gate (admin only) ──────────────────────────
    if (action === "pass_gate") {
      if (!isAdmin) return Response.json({ error: "Admin only" }, { status: 403 });
      const challenge_id = String(body.challenge_id || "");
      const gate_code = String(body.gate_code || "");
      if (!challenge_id || !gate_code) {
        return Response.json({ error: "challenge_id and gate_code required" }, { status: 400 });
      }
      if (!GATE_CODES.includes(gate_code)) {
        return Response.json({ error: "Invalid gate_code" }, { status: 400 });
      }
      await recheckPermitFindings(sr, challenge_id, actor);
      const result = await passGate(sr, challenge_id, gate_code, actor, { challengeData: body.challenge_data });
      if (!result.passed) {
        return Response.json({ error: "Gate cannot be passed: conditions not met.", ...result }, { status: 409 });
      }
      return Response.json({ ok: true, ...result });
    }

    // ── evaluate_all: evaluate every upstream challenge (admin only) ─
    // Evaluation + labeling pass. Does NOT republish or alter any
    // challenge's live/public state. Grandfathered-live challenges are
    // auto-passed up to their current phase to preserve live state and
    // activate the lifecycle gate system (so launch_blocked becomes
    // read-only/historical). Every gate evaluation is audit-logged.
    if (action === "evaluate_all") {
      if (!isAdmin) return Response.json({ error: "Admin only" }, { status: 403 });

      const apiKey = secrets.get("CHALLENGE_API_KEY");
      const baseUrl = secrets.get("CHALLENGE_API_BASE_URL");
      if (!apiKey) return Response.json({ error: "CHALLENGE_API_KEY secret not set" }, { status: 500 });

      const data = await fetchChallengeApi("challenges", { limit: 500 }, apiKey, baseUrl);
      const upstream = data.challenges || [];

      // Index existing interim gates (for grandfathered_live flag).
      const interimGates = await sr.entities.ComplianceGate.list("-created_date", 500).catch(() => []);
      const interimByCid = {};
      for (const g of interimGates || []) interimByCid[String(g.challenge_id)] = g;

      const results = [];
      let grandfatheredCount = 0;

      for (const c of upstream) {
        const cid = String(c.id || c._id || "");
        if (!cid) continue;
        const challengeData = {
          id: cid,
          theme: c.theme || c.title || "",
          title: c.title || c.theme || "",
          category: c.category || "",
          brief: c.brief || c.description || "",
          starts_at: c.starts_at,
          submission_ends_at: c.submission_ends_at || c.end_date,
          voting_ends_at: c.voting_ends_at || c.voting_end_date,
        };

        await recheckPermitFindings(sr, cid, actor);

        // Evaluate every gate and log it.
        const gateResults = {};
        for (const gate_code of GATE_CODES) {
          const evalResult = await evaluateGate(sr, cid, gate_code, challengeData);
          await logGateEvaluation(sr, cid, gate_code, evalResult, actor);
          gateResults[gate_code] = { can_pass: evalResult.can_pass, missing: evalResult.missing };
        }

        // Grandfather live challenges: auto-pass gates up to current phase.
        const interim = interimByCid[cid];
        const grandfatheredLive = !!(interim && interim.grandfathered_live === true);
        let grandfatheredGates = [];
        if (grandfatheredLive) {
          const phase = challengePhase(challengeData);
          grandfatheredGates = grandfatheredGatesForPhase(phase);
          for (const gate_code of grandfatheredGates) {
            await passGate(sr, cid, gate_code, actor, { grandfathered: true, challengeData });
          }
          if (grandfatheredGates.length) grandfatheredCount++;
        }

        results.push({
          challenge_id: cid,
          challenge_title: challengeData.theme || interim?.challenge_title || "",
          phase: challengePhase(challengeData),
          grandfathered_live: grandfatheredLive,
          grandfathered_gates: grandfatheredGates,
          gates: gateResults,
        });
      }

      return Response.json({
        total: upstream.length,
        evaluated: results.length,
        grandfathered: grandfatheredCount,
        results,
      });
    }

    return Response.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}