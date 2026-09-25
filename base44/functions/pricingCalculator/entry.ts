import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { secrets } from 'base44:runtime';
import { verifyCustomSession } from '../../shared/customSession.ts';
import { isAdminCaller } from '../../shared/adminAuth.ts';

// Pricing Calculator & Rate Card (Prompt 24) — backend function.
//
//   Public (any authed):
//   action: 'get_active_rate_card' → active RateCard + service tiers + scale bands + deliverables + categories
//   action: 'save_quote'           → { rate_card_id, configuration, computed_lines, subtotal, gst, total, is_enterprise }
//                                   creates a SavedQuote snapshot. Stores the rate card version.
//   action: 'get_saved_quote'      → { saved_quote_id } returns stored snapshot + the rate card version it was saved with
//   action: 'link_quote_to_intake' → { saved_quote_id, intake_response_id } links a SavedQuote to an IntakeResponse
//   action: 'get_quote_for_intake' → { intake_response_id } returns the SavedQuote linked to an IntakeResponse
//
//   Admin:
//   action: 'list_rate_cards'      → all versions
//   action: 'save_rate_card'       → clones active → new version with supplied fields (deactivates old). Editing always creates a new version.

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const apiKey = secrets.get("CHALLENGE_API_KEY") || "";
    // Accept either a platform session or the custom (main-site) login's
    // signed session token — the published site uses the latter.
    let user: any = await base44.auth.me().catch(() => null);
    if (!user && body.session_token) {
      const session = await verifyCustomSession(String(body.session_token), apiKey).catch(() => null);
      if (session?.email) user = { email: session.email };
    }
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const action = body.action;
    const sr = base44.asServiceRole;
    const isAdmin = await isAdminCaller(base44, body.session_token || "", apiKey);

    // ── get_active_rate_card ──────────────────────────────────────────
    if (action === "get_active_rate_card") {
      const rcs = await sr.entities.RateCard.filter({ is_active: true }, "-version", 1);
      const rateCard = rcs && rcs[0];
      const [tiers, bands, deliverables, categories] = await Promise.all([
        sr.entities.ServiceTier.list("sort_order", 50),
        sr.entities.CampaignScaleBand.list("sort_order", 50),
        sr.entities.Deliverable.list("sort_order", 200),
        sr.entities.Category.list("sort_order", 100).catch(() => []),
      ]);
      return Response.json({
        rate_card: rateCard || null,
        service_tiers: tiers || [],
        scale_bands: bands || [],
        deliverables: deliverables || [],
        categories: categories || [],
      });
    }

    // ── save_quote (public) ───────────────────────────────────────────
    if (action === "save_quote") {
      const rate_card_id = String(body.rate_card_id || "");
      if (!rate_card_id) return Response.json({ error: "rate_card_id required" }, { status: 400 });
      const rcs = await sr.entities.RateCard.filter({ id: rate_card_id }, "-created_date", 1);
      const rc = rcs && rcs[0];
      const rate_card_version = rc?.version || 1;
      const saved = await sr.entities.SavedQuote.create({
        rate_card_id,
        rate_card_version,
        configuration: body.configuration || {},
        computed_lines: Array.isArray(body.computed_lines) ? body.computed_lines : [],
        subtotal: Number(body.subtotal || 0),
        gst: Number(body.gst || 0),
        total: Number(body.total || 0),
        is_enterprise: !!body.is_enterprise,
        created_for: String(body.created_for || user.email || ""),
        intake_response_id: "",
      });
      return Response.json({ saved_quote: saved });
    }

    // ── get_saved_quote (public) — returns stored snapshot ────────────
    if (action === "get_saved_quote") {
      const saved_quote_id = String(body.saved_quote_id || "");
      if (!saved_quote_id) return Response.json({ error: "saved_quote_id required" }, { status: 400 });
      const qs = await sr.entities.SavedQuote.filter({ id: saved_quote_id }, "-created_date", 1);
      const sq = qs && qs[0];
      if (!sq) return Response.json({ error: "Saved quote not found" }, { status: 404 });
      const rcs = await sr.entities.RateCard.filter({ id: sq.rate_card_id }, "-created_date", 1);
      return Response.json({ saved_quote: sq, rate_card: (rcs && rcs[0]) || null });
    }

    // ── link_quote_to_intake (public) ─────────────────────────────────
    if (action === "link_quote_to_intake") {
      const saved_quote_id = String(body.saved_quote_id || "");
      const intake_response_id = String(body.intake_response_id || "");
      if (!saved_quote_id || !intake_response_id)
        return Response.json({ error: "saved_quote_id and intake_response_id required" }, { status: 400 });
      await sr.entities.SavedQuote.update(saved_quote_id, { intake_response_id });
      return Response.json({ ok: true });
    }

    // ── get_quote_for_intake (public) ─────────────────────────────────
    if (action === "get_quote_for_intake") {
      const intake_response_id = String(body.intake_response_id || "");
      if (!intake_response_id) return Response.json({ error: "intake_response_id required" }, { status: 400 });
      const qs = await sr.entities.SavedQuote.filter({ intake_response_id }, "-created_date", 1);
      return Response.json({ saved_quote: (qs && qs[0]) || null });
    }

    // ── Admin: list_rate_cards ─────────────────────────────────────────
    if (action === "list_rate_cards") {
      if (!isAdmin) return Response.json({ error: "Admin only" }, { status: 403 });
      const list = await sr.entities.RateCard.list("-version", 50);
      return Response.json({ rate_cards: list || [] });
    }

    // ── Admin: save_rate_card — creates a new version ─────────────────
    if (action === "save_rate_card") {
      if (!isAdmin) return Response.json({ error: "Admin only" }, { status: 403 });
      const active = await sr.entities.RateCard.filter({ is_active: true }, "-version", 1);
      const current = active && active[0];
      const newVersion = (current?.version || 0) + 1;
      // Deactivate old active versions.
      for (const rc of active || []) await sr.entities.RateCard.update(rc.id, { is_active: false });
      const created = await sr.entities.RateCard.create({
        version: newVersion,
        is_active: true,
        superseded_by_id: "",
        change_note: String(body.change_note || ""),
        tier_base_fees: body.tier_base_fees ?? current?.tier_base_fees ?? {},
        participants_included: body.participants_included ?? current?.participants_included ?? {},
        per_extra_100: body.per_extra_100 ?? current?.per_extra_100 ?? {},
        weeks_included: body.weeks_included ?? current?.weeks_included ?? {},
        per_extra_week: body.per_extra_week ?? current?.per_extra_week ?? {},
        judging_fees: body.judging_fees ?? current?.judging_fees ?? {},
        permit_assistance_fee: Number(body.permit_assistance_fee ?? current?.permit_assistance_fee ?? 0),
        prize_admin_pct: Number(body.prize_admin_pct ?? current?.prize_admin_pct ?? 0),
        addon_fees: body.addon_fees ?? current?.addon_fees ?? {},
        program_discounts: body.program_discounts ?? current?.program_discounts ?? {},
        gst_pct: Number(body.gst_pct ?? current?.gst_pct ?? 10),
      });
      if (current) await sr.entities.RateCard.update(current.id, { superseded_by_id: created.id });
      return Response.json({ rate_card: created });
    }

    return Response.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}