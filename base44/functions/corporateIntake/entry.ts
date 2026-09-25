import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { secrets } from "base44:runtime";
import { aggregateWeights, resolveAndBuild, DIMENSIONS } from "../../shared/corporateIntakeHelper.ts";
import { fetchChallengeApi } from "../../shared/challengeApiHelper.ts";

// Corporate Services Module (Prompt 22) — backend function.
//
//   action: 'get_questionnaire'   → active questionnaire + questions + options (any authed)
//   action: 'submit_intake'       → { host_org?, questionnaire_id, selected_option_ids, free_text_answers }
//                                   creates/links HostOrganisation, IntakeResponse, ChallengeRecommendation,
//                                   pre-creates a ChallengeDraft with compliance flags. (any authed)
//   action: 'get_recommendation'  → { response_id } full recommendation (any authed)
//   action: 'list_account_types'  → seeded HostAccountType records (any authed)
//   action: 'list_service_tiers'  → seeded ServiceTier records (any authed)
//
//   Admin:
//   action: 'list_responses'      → filter by status/tier/account_type/flags/program_scope (admin)
//   action: 'get_response_detail' → { response_id } full response + recommendation + draft (admin)
//   action: 'list_questionnaires' → all versions (admin)
//   action: 'create_questionnaire_version' → clone active → new version (admin)

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    // Anonymous visitors may read the public questionnaire; everything that
    // writes or reads private data still requires a signed-in user.
    const user = await base44.auth.me().catch(() => null);
    const body = await req.json().catch(() => ({}));
    const action = body.action;
    const sr = base44.asServiceRole;
    const isAdmin = !!user && (user.role === "admin" || user.is_admin === true);
    const PUBLIC_ACTIONS = ["get_questionnaire", "list_account_types", "list_service_tiers", "list_scale_bands", "list_deliverables"];
    if (!user && !PUBLIC_ACTIONS.includes(action)) {
      return Response.json({ error: "Please sign in to continue." }, { status: 401 });
    }

    // ── get_questionnaire ────────────────────────────────────────────
    if (action === "get_questionnaire") {
      const qs = await sr.entities.IntakeQuestionnaire.filter({ is_active: true }, "-version", 1);
      const questionnaire = qs && qs[0];
      if (!questionnaire) return Response.json({ questionnaire: null, questions: [] });
      const questions = await sr.entities.IntakeQuestion.filter(
        { questionnaire_id: questionnaire.id }, "sort_order", 100
      );
      const options = await sr.entities.IntakeAnswerOption.list("sort_order", 500);
      const optsByQ = {};
      for (const o of options || []) {
        if (!optsByQ[o.question_id]) optsByQ[o.question_id] = [];
        optsByQ[o.question_id].push(o);
      }
      const out = (questions || []).map((q) => ({
        ...q,
        options: (optsByQ[q.id] || []).map((o) => ({
          id: o.id, label: o.label, weight: o.weight, sort_order: o.sort_order,
          compliance_flags: o.compliance_flags || [], service_tier_id: o.service_tier_id || "",
        })),
      }));
      return Response.json({ questionnaire, questions: out });
    }

    // ── list_account_types / list_service_tiers ──────────────────────
    if (action === "list_account_types") {
      const list = await sr.entities.HostAccountType.list("sort_order", 50);
      return Response.json({ account_types: list || [] });
    }
    if (action === "list_service_tiers") {
      const list = await sr.entities.ServiceTier.list("sort_order", 50);
      return Response.json({ service_tiers: list || [] });
    }

    // ── submit_intake ────────────────────────────────────────────────
    if (action === "submit_intake") {
      const questionnaire_id = String(body.questionnaire_id || "");
      if (!questionnaire_id) return Response.json({ error: "questionnaire_id required" }, { status: 400 });
      const selected_option_ids = Array.isArray(body.selected_option_ids) ? body.selected_option_ids : [];
      if (!selected_option_ids.length) return Response.json({ error: "No answers selected" }, { status: 400 });

      // Create or link host organisation.
      let host_id = String(body.host_organisation_id || "");
      if (!host_id && body.host_org) {
        const ho = await sr.entities.HostOrganisation.create({
          name: String(body.host_org.name || ""),
          account_type_id: String(body.host_org.account_type_id || ""),
          abn: String(body.host_org.abn || ""),
          contacts: String(body.host_org.contacts || ""),
          state: String(body.host_org.state || ""),
          billing_status: "none",
          internal_notes: "",
        });
        host_id = ho.id;
      }
      if (!host_id) return Response.json({ error: "Host organisation required" }, { status: 400 });

      const qs = await sr.entities.IntakeQuestionnaire.filter({ id: questionnaire_id }, "-created_date", 1);
      const questionnaire = qs && qs[0];
      const questionnaire_version = questionnaire?.version || 1;

      // Fetch full option records (for weight aggregation).
      const optRecords = [];
      for (const oid of selected_option_ids) {
        const found = await sr.entities.IntakeAnswerOption.filter({ id: oid }, "-created_date", 1).catch(() => []);
        if (found && found[0]) optRecords.push(found[0]);
      }

      // Aggregate recommendation.
      const { byDimension, complianceFlags, serviceTierId } = aggregateWeights(optRecords);
      const recommendation = await resolveAndBuild(sr, byDimension, optRecords, complianceFlags, serviceTierId);

      // Derive campaign scale band from the selected option that carries one
      // (Prompt 23 — intake Q8 audience breadth maps to a CampaignScaleBand).
      let scaleBandId = "";
      for (const o of optRecords) {
        if (o.scale_band_id) { scaleBandId = o.scale_band_id; break; }
      }

      // Initialise the producer deliverable checklist from the matched tier.
      let tierDeliverables = [];
      if (serviceTierId) {
        const tierRec = await sr.entities.ServiceTier.filter({ id: serviceTierId }, "-created_date", 1).catch(() => []);
        if (tierRec && tierRec[0]) tierDeliverables = tierRec[0].deliverables || [];
      }

      // Persist IntakeResponse (references original question/option IDs — versioning safe).
      const response = await sr.entities.IntakeResponse.create({
        host_organisation_id: host_id,
        questionnaire_id,
        questionnaire_version,
        selected_option_ids,
        free_text_answers: body.free_text_answers || {},
        submitted_at: new Date().toISOString(),
      });

      // Persist recommendation.
      const rec = await sr.entities.ChallengeRecommendation.create({
        response_id: response.id,
        host_organisation_id: host_id,
        top_mechanics: recommendation.mechanic || [],
        top_categories: recommendation.category || [],
        top_modes: recommendation.mode || [],
        top_audiences: recommendation.audience || [],
        top_scoring: recommendation.scoring || [],
        top_evidence: recommendation.evidence || [],
        top_pathways: recommendation.pathway || [],
        compliance_flags: recommendation.complianceFlags || [],
        rationale_summary: recommendation.rationaleSummary || "",
        service_tier_id: recommendation.serviceTierId || "",
      });

      await sr.entities.IntakeResponse.update(response.id, { recommendation_id: rec.id });

      // Pre-create a ChallengeDraft with compliance flags pre-fired so the
      // assessment engine surfaces obligations from the first save. Draft
      // cannot go live except through the lifecycle gates (Prompt 17).
      const draft = await sr.entities.ChallengeDraft.create({
        origin: "corporate_intake",
        host_organisation_id: host_id,
        recommendation_id: rec.id,
        service_tier_id: recommendation.serviceTierId || "",
        scale_band: scaleBandId,
        program_scope: String(body.program_scope || "single"),
        review_status: "intake_received",
        challenge_title: String(body.host_org?.name || "") + " Challenge",
        deliverables: tierDeliverables,
        recommended_snapshot: {
          mechanics: recommendation.mechanic || [],
          categories: recommendation.category || [],
          modes: recommendation.mode || [],
          audiences: recommendation.audience || [],
          scoring: recommendation.scoring || [],
          evidence: recommendation.evidence || [],
          pathways: recommendation.pathway || [],
        },
        compliance_flags: recommendation.complianceFlags || [],
      });

      return Response.json({ response_id: response.id, recommendation_id: rec.id, draft_id: draft.id, recommendation: rec, draft });
    }

    // ── get_recommendation ───────────────────────────────────────────
    if (action === "get_recommendation") {
      const response_id = String(body.response_id || "");
      if (!response_id) return Response.json({ error: "response_id required" }, { status: 400 });
      const recs = await sr.entities.ChallengeRecommendation.filter({ response_id }, "-created_date", 1);
      return Response.json({ recommendation: (recs && recs[0]) || null });
    }

    // ── Admin: list_responses ─────────────────────────────────────────
    if (action === "list_responses") {
      if (!isAdmin) return Response.json({ error: "Admin only" }, { status: 403 });
      const responses = await sr.entities.IntakeResponse.list("-submitted_at", 200);
      const drafts = await sr.entities.ChallengeDraft.list("-created_date", 200);
      const draftsByHost = {};
      for (const d of drafts || []) {
        if (!draftsByHost[d.host_organisation_id]) draftsByHost[d.host_organisation_id] = d;
      }
      const orgs = await sr.entities.HostOrganisation.list("-created_date", 200);
      const orgsById = {};
      for (const o of orgs || []) orgsById[o.id] = o;
      const recs = await sr.entities.ChallengeRecommendation.list("-created_date", 200);
      const recsByResp = {};
      for (const r of recs || []) recsByResp[r.response_id] = r;

      let out = (responses || []).map((r) => {
        const draft = draftsByHost[r.host_organisation_id];
        const rec = recsByResp[r.id];
        return {
          response_id: r.id, submitted_at: r.submitted_at,
          host: orgsById[r.host_organisation_id] || null,
          recommendation: rec || null,
          draft: draft || null,
        };
      });

      // Filters: status, tier, account_type, flags, program_scope
      const f = body.filter || {};
      if (f.review_status) out = out.filter((x) => x.draft?.review_status === f.review_status);
      if (f.service_tier_id) out = out.filter((x) => x.draft?.service_tier_id === f.service_tier_id);
      if (f.account_type_id) out = out.filter((x) => x.host?.account_type_id === f.account_type_id);
      if (f.program_scope) out = out.filter((x) => x.draft?.program_scope === f.program_scope);
      if (f.compliance_flag) out = out.filter((x) => (x.draft?.compliance_flags || []).includes(f.compliance_flag));
      return Response.json({ responses: out });
    }

    // ── Admin: get_response_detail ───────────────────────────────────
    if (action === "get_response_detail") {
      if (!isAdmin) return Response.json({ error: "Admin only" }, { status: 403 });
      const response_id = String(body.response_id || "");
      if (!response_id) return Response.json({ error: "response_id required" }, { status: 400 });
      const rs = await sr.entities.IntakeResponse.filter({ id: response_id }, "-created_date", 1);
      const response = rs && rs[0];
      if (!response) return Response.json({ error: "Response not found" }, { status: 404 });
      const recs = await sr.entities.ChallengeRecommendation.filter({ response_id }, "-created_date", 1);
      const drafts = await sr.entities.ChallengeDraft.filter({ host_organisation_id: response.host_organisation_id }, "-created_date", 1);
      const orgs = await sr.entities.HostOrganisation.filter({ id: response.host_organisation_id }, "-created_date", 1);
      // Reconstruct the selected option labels for the rationale view.
      const optLabels = [];
      for (const oid of response.selected_option_ids || []) {
        const o = await sr.entities.IntakeAnswerOption.filter({ id: oid }, "-created_date", 1).catch(() => []);
        if (o && o[0]) optLabels.push({ id: oid, label: o[0].label, compliance_flags: o[0].compliance_flags || [] });
      }
      return Response.json({
        response,
        recommendation: (recs && recs[0]) || null,
        draft: (drafts && drafts[0]) || null,
        host: (orgs && orgs[0]) || null,
        selected_options: optLabels,
      });
    }

    // ── Admin: list_questionnaires ───────────────────────────────────
    if (action === "list_questionnaires") {
      if (!isAdmin) return Response.json({ error: "Admin only" }, { status: 403 });
      const list = await sr.entities.IntakeQuestionnaire.list("-version", 50);
      return Response.json({ questionnaires: list || [] });
    }

    // ── Admin: create_questionnaire_version ──────────────────────────
    // Clones the active questionnaire's questions + options into a new version.
    // Editing an active version creates a new one; historical responses keep
    // their original question/option IDs.
    if (action === "create_questionnaire_version") {
      if (!isAdmin) return Response.json({ error: "Admin only" }, { status: 403 });
      const source_id = String(body.source_questionnaire_id || "");
      const change_note = String(body.change_note || "");
      if (!source_id) return Response.json({ error: "source_questionnaire_id required" }, { status: 400 });
      const src = await sr.entities.IntakeQuestionnaire.filter({ id: source_id }, "-created_date", 1);
      const source = src && src[0];
      if (!source) return Response.json({ error: "Source questionnaire not found" }, { status: 404 });

      // Deactivate old active versions.
      const active = await sr.entities.IntakeQuestionnaire.filter({ is_active: true }, "-version", 10);
      for (const q of active || []) await sr.entities.IntakeQuestionnaire.update(q.id, { is_active: false });

      const newQ = await sr.entities.IntakeQuestionnaire.create({
        name: source.name,
        version: (source.version || 1) + 1,
        is_active: true,
        superseded_by_id: "",
        change_note,
      });
      await sr.entities.IntakeQuestionnaire.update(source.id, { superseded_by_id: newQ.id });

      // Clone questions + options.
      const questions = await sr.entities.IntakeQuestion.filter({ questionnaire_id: source_id }, "sort_order", 100);
      for (const q of questions || []) {
        const newQn = await sr.entities.IntakeQuestion.create({
          questionnaire_id: newQ.id,
          prompt: q.prompt,
          type: q.type,
          sort_order: q.sort_order,
          is_required: q.is_required,
        });
        const opts = await sr.entities.IntakeAnswerOption.filter({ question_id: q.id }, "sort_order", 50);
        const clones = (opts || []).map((o) => ({
          question_id: newQn.id,
          label: o.label,
          weight: o.weight,
          sort_order: o.sort_order,
          mechanic_ids: o.mechanic_ids || [],
          category_ids: o.category_ids || [],
          mode_ids: o.mode_ids || [],
          audience_ids: o.audience_ids || [],
          scoring_ids: o.scoring_ids || [],
          evidence_ids: o.evidence_ids || [],
          pathway_ids: o.pathway_ids || [],
          service_tier_id: o.service_tier_id || "",
          compliance_flags: o.compliance_flags || [],
        }));
        if (clones.length) await sr.entities.IntakeAnswerOption.bulkCreate(clones);
      }
      return Response.json({ questionnaire: newQ, cloned_questions: questions?.length || 0 });
    }

    // ── Service Delivery (Prompt 23) — reference data ───────────────
    if (action === "list_scale_bands") {
      const list = await sr.entities.CampaignScaleBand.list("sort_order", 50);
      return Response.json({ scale_bands: list || [] });
    }
    if (action === "list_deliverables") {
      const list = await sr.entities.Deliverable.list("sort_order", 200);
      return Response.json({ deliverables: list || [] });
    }
    if (action === "list_resource_types") {
      const list = await sr.entities.ResourceType.list("sort_order", 100);
      return Response.json({ resource_types: list || [] });
    }

    // ── Admin: get_service_delivery ──────────────────────────────────
    if (action === "get_service_delivery") {
      if (!isAdmin) return Response.json({ error: "Admin only" }, { status: 403 });
      const draft_id = String(body.draft_id || "");
      if (!draft_id) return Response.json({ error: "draft_id required" }, { status: 400 });
      const ds = await sr.entities.ChallengeDraft.filter({ id: draft_id }, "-created_date", 1);
      const draft = ds && ds[0];
      if (!draft) return Response.json({ error: "Draft not found" }, { status: 404 });

      const [bands, deliverables, resourceTypes, tiers] = await Promise.all([
        sr.entities.CampaignScaleBand.list("sort_order", 50),
        sr.entities.Deliverable.list("sort_order", 200),
        sr.entities.ResourceType.list("sort_order", 100),
        sr.entities.ServiceTier.list("sort_order", 50),
      ]);
      const band = (bands || []).find((b) => b.id === draft.scale_band) || null;
      const tier = (tiers || []).find((t) => t.id === draft.service_tier_id) || null;

      const quotes = await sr.entities.EnterpriseQuote.filter({ draft_id }, "-created_date", 10);
      const quote = (quotes && quotes[0]) || null;
      let allocations = [];
      if (quote) {
        allocations = await sr.entities.ResourceAllocation.filter({ draft_id }, "created_date", 100);
      }
      return Response.json({
        draft, band, tier,
        deliverables: deliverables || [],
        resource_types: resourceTypes || [],
        scale_bands: bands || [],
        draft_deliverables: draft.deliverables || [],
        quote, allocations: allocations || [],
      });
    }

    // ── Admin: update_draft_deliverables ─────────────────────────────
    if (action === "update_draft_deliverables") {
      if (!isAdmin) return Response.json({ error: "Admin only" }, { status: 403 });
      const draft_id = String(body.draft_id || "");
      const deliverables = Array.isArray(body.deliverables) ? body.deliverables : [];
      if (!draft_id) return Response.json({ error: "draft_id required" }, { status: 400 });
      await sr.entities.ChallengeDraft.update(draft_id, { deliverables });
      return Response.json({ ok: true, deliverables });
    }

    // ── Admin: update_draft_scale_band ──────────────────────────────
    if (action === "update_draft_scale_band") {
      if (!isAdmin) return Response.json({ error: "Admin only" }, { status: 403 });
      const draft_id = String(body.draft_id || "");
      const scale_band = String(body.scale_band_id || "");
      if (!draft_id) return Response.json({ error: "draft_id required" }, { status: 400 });
      await sr.entities.ChallengeDraft.update(draft_id, { scale_band });
      return Response.json({ ok: true, scale_band });
    }

    // ── Admin: compute_quote ─────────────────────────────────────────
    // Pure calculator: rate × qty per line (override wins), plus the stored
    // packaged floor. The floor is a floor, never a ceiling — the total is
    // max(floor, sum(lines)). Returns the breakdown; does not persist.
    if (action === "compute_quote") {
      if (!isAdmin) return Response.json({ error: "Admin only" }, { status: 403 });
      const draft_id = String(body.draft_id || "");
      const allocations = Array.isArray(body.allocations) ? body.allocations : [];
      const packaged_floor = Number(body.packaged_floor || 0);
      if (!draft_id) return Response.json({ error: "draft_id required" }, { status: 400 });

      const resourceTypes = await sr.entities.ResourceType.list("sort_order", 100);
      const rtById = {};
      for (const rt of resourceTypes || []) rtById[rt.id] = rt;

      let linesTotal = 0;
      const line_items = allocations.map((a) => {
        const rt = rtById[a.resource_type_id] || {};
        const rate = Number(a.rate_override) > 0 ? Number(a.rate_override) : Number(rt.rate || 0);
        const qty = Number(a.quantity || 1);
        const lineTotal = rate * qty;
        linesTotal += lineTotal;
        return {
          resource_type_id: a.resource_type_id,
          name: rt.name || "(unknown)",
          unit: rt.unit || "",
          quantity: qty,
          rate,
          line_total: lineTotal,
          notes: a.notes || "",
        };
      });
      const total = Math.max(packaged_floor, linesTotal);
      return Response.json({ line_items, lines_total: linesTotal, packaged_floor, total });
    }

    // ── Admin: save_quote ────────────────────────────────────────────
    // Create or update an EnterpriseQuote for a draft and replace its
    // ResourceAllocation records with the supplied set.
    if (action === "save_quote") {
      if (!isAdmin) return Response.json({ error: "Admin only" }, { status: 403 });
      const draft_id = String(body.draft_id || "");
      if (!draft_id) return Response.json({ error: "draft_id required" }, { status: 400 });
      const allocations = Array.isArray(body.allocations) ? body.allocations : [];
      const packaged_floor = Number(body.packaged_floor || 0);
      const account_manager = String(body.account_manager || "");

      // Compute line items (reuse calculator logic).
      const resourceTypes = await sr.entities.ResourceType.list("sort_order", 100);
      const rtById = {};
      for (const rt of resourceTypes || []) rtById[rt.id] = rt;
      let linesTotal = 0;
      const line_items = allocations.map((a) => {
        const rt = rtById[a.resource_type_id] || {};
        const rate = Number(a.rate_override) > 0 ? Number(a.rate_override) : Number(rt.rate || 0);
        const qty = Number(a.quantity || 1);
        const lineTotal = rate * qty;
        linesTotal += lineTotal;
        return {
          resource_type_id: a.resource_type_id,
          name: rt.name || "(unknown)",
          unit: rt.unit || "",
          quantity: qty,
          rate,
          line_total: lineTotal,
          notes: a.notes || "",
        };
      });

      let quote;
      if (body.quote_id) {
        const existing = await sr.entities.EnterpriseQuote.filter({ id: String(body.quote_id) }, "-created_date", 1);
        quote = existing && existing[0];
      }
      if (quote) {
        await sr.entities.EnterpriseQuote.update(quote.id, {
          line_items, packaged_floor, account_manager,
        });
        // Re-fetch so the response reflects the persisted write.
        const refreshed = await sr.entities.EnterpriseQuote.filter({ id: quote.id }, "-created_date", 1);
        quote = (refreshed && refreshed[0]) || quote;
      } else {
        quote = await sr.entities.EnterpriseQuote.create({
          draft_id, line_items, packaged_floor,
          status: "draft", account_manager,
        });
      }

      // Replace allocations: delete old, insert new.
      const oldAllocs = await sr.entities.ResourceAllocation.filter({ draft_id }, "created_date", 200);
      for (const o of oldAllocs || []) await sr.entities.ResourceAllocation.delete(o.id).catch(() => {});
      if (allocations.length) {
        await sr.entities.ResourceAllocation.bulkCreate(
          allocations.map((a) => ({
            draft_id,
            resource_type_id: String(a.resource_type_id),
            quantity: Number(a.quantity || 1),
            rate_override: Number(a.rate_override || 0),
            notes: String(a.notes || ""),
          }))
        );
      }
      return Response.json({ quote });
    }

    // ── Admin: accept_quote / decline_quote ──────────────────────────
    if (action === "accept_quote" || action === "decline_quote") {
      if (!isAdmin) return Response.json({ error: "Admin only" }, { status: 403 });
      const quote_id = String(body.quote_id || "");
      if (!quote_id) return Response.json({ error: "quote_id required" }, { status: 400 });
      const status = action === "accept_quote" ? "accepted" : "declined";
      await sr.entities.EnterpriseQuote.update(quote_id, { status });
      return Response.json({ ok: true, quote_id, status });
    }

    // ── Admin: set_draft_status ─────────────────────────────────────
    // Enforces the HARD RULE: a draft whose scale band has
    // pricing_mode = by_proposal cannot reach 'approved' without an
    // accepted EnterpriseQuote.
    if (action === "set_draft_status") {
      if (!isAdmin) return Response.json({ error: "Admin only" }, { status: 403 });
      const draft_id = String(body.draft_id || "");
      const review_status = String(body.review_status || "");
      if (!draft_id || !review_status) return Response.json({ error: "draft_id and review_status required" }, { status: 400 });
      const ds = await sr.entities.ChallengeDraft.filter({ id: draft_id }, "-created_date", 1);
      const draft = ds && ds[0];
      if (!draft) return Response.json({ error: "Draft not found" }, { status: 404 });

      if (review_status === "approved") {
        if (draft.scale_band) {
          const bs = await sr.entities.CampaignScaleBand.filter({ id: draft.scale_band }, "-created_date", 1);
          const band = bs && bs[0];
          if (band && band.pricing_mode === "by_proposal") {
            const qs = await sr.entities.EnterpriseQuote.filter({ draft_id }, "-created_date", 10);
            const hasAccepted = (qs || []).some((q) => q.status === "accepted");
            if (!hasAccepted) {
              return Response.json(
                { error: "This draft is on a by-proposal scale band and cannot be approved without an accepted enterprise quote." },
                { status: 409 }
              );
            }
          }
        }
      }
      await sr.entities.ChallengeDraft.update(draft_id, { review_status });
      return Response.json({ ok: true, review_status });
    }

    // ── Admin: publish_to_main ───────────────────────────────────────
    // Pushes an approved intake draft into the MAIN challenge system via the
    // upstream Challenge API (POST create_challenge) and records the returned
    // upstream challenge id on the draft.
    if (action === "publish_to_main") {
      if (!isAdmin) return Response.json({ error: "Admin only" }, { status: 403 });
      const draft_id = String(body.draft_id || "");
      const start_date = String(body.start_date || "");
      const end_date = String(body.end_date || "");
      if (!draft_id || !start_date || !end_date) {
        return Response.json({ error: "draft_id, start_date and end_date are required" }, { status: 400 });
      }
      const ds = await sr.entities.ChallengeDraft.filter({ id: draft_id }, "-created_date", 1);
      const draft = ds && ds[0];
      if (!draft) return Response.json({ error: "Draft not found" }, { status: 404 });
      if (draft.challenge_id) {
        return Response.json({ error: "This proposal has already been published to the main system" }, { status: 409 });
      }

      const title = String(body.title || draft.challenge_title || "Untitled challenge");
      const description = String(body.description || draft.challenge_description || title);
      const category = String(body.category || draft.category || "");

      const upstream = await fetchChallengeApi("create_challenge", {
        title,
        theme: title,
        description,
        category,
        start_date,
        end_date,
      }, secrets.get("CHALLENGE_API_KEY"), secrets.get("CHALLENGE_API_BASE_URL"));

      const upstreamId = upstream?.challenge?.id || upstream?.id || "";
      if (upstream?.error || !upstreamId) {
        return Response.json({ error: upstream?.error || "Main system did not return a challenge id" }, { status: 502 });
      }

      await sr.entities.ChallengeDraft.update(draft_id, {
        challenge_id: String(upstreamId),
        review_status: "live",
      });
      return Response.json({ ok: true, challenge_id: String(upstreamId), upstream });
    }

    return Response.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}