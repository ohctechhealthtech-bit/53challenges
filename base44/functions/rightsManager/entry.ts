// rightsManager — Participant Rights & Marketing Consent Backend (Prompt 21)
//
// Actions:
//   list_templates, sign_template
//   get_config, save_config
//   get_rights_summary
//   capture_rights (entry flow consent capture)
//   get_rights_record
//   create_music_declaration, clear_music_declaration
//   create_media_release, grant_media_release
//   check_use (marketing-use gate)
//   log_use (writes MarketingUseLog after cleared check)
//   list_use_logs
//   revoke_scope
//   get_effective_scopes

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import {
  getActiveTemplates,
  getRightsConfig,
  getRightsRecordForEntry,
  getMusicDeclarationsForEntry,
  getMediaReleasesForEntry,
  getGuardianConsentForRights,
  computeEffectiveScopes,
  checkUseCleared,
  revokeScope,
  buildRightsSummary,
  isTemplateSigned,
  TIERS,
  TIER1_SCOPES,
  TIER2_SCOPES,
  TIER3_SCOPES,
} from "../../shared/rightsHelper.ts";

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const sr = base44.asServiceRole;
    const body = await req.json().catch(() => ({}));
    const action = body.action;

    // ── Template management ───────────────────────────────────────────────
    if (action === "list_templates") {
      const all = await sr.entities.RightsGrantTemplate.filter(
        { is_current: true }, "sort_order", 500
      ).catch(() => []);
      return Response.json({ templates: all || [] });
    }

    if (action === "sign_template") {
      if (user.role !== "admin") return Response.json({ error: "Admin only" }, { status: 403 });
      const { template_id, reviewer, date, reference } = body;
      if (!template_id || !reviewer || !date || !reference) {
        return Response.json({ error: "template_id, reviewer, date, reference required" }, { status: 400 });
      }
      const updated = await sr.entities.RightsGrantTemplate.update(template_id, {
        legal_signoff: { reviewer, date, reference },
      });
      return Response.json({ template: updated });
    }

    // ── Challenge rights configuration ───────────────────────────────────
    if (action === "get_config") {
      const { challenge_id } = body;
      if (!challenge_id) return Response.json({ error: "challenge_id required" }, { status: 400 });
      const config = await getRightsConfig(sr, challenge_id);
      return Response.json({ config });
    }

    if (action === "save_config") {
      if (user.role !== "admin") return Response.json({ error: "Admin only" }, { status: 403 });
      const { challenge_id, included_scope_versions, music_policy, third_party_policy, sponsor_use_period, marketing_contact_senders } = body;
      if (!challenge_id) return Response.json({ error: "challenge_id required" }, { status: 400 });

      const existing = await sr.entities.ChallengeRightsConfiguration.filter(
        { challenge_id: String(challenge_id) }, "-created_date", 1
      ).catch(() => []);

      const data = {
        challenge_id: String(challenge_id),
        included_scope_versions: included_scope_versions || [],
        music_policy: music_policy || "original_or_licensed_only",
        third_party_policy: third_party_policy || "none_permitted",
        sponsor_use_period: sponsor_use_period || "",
        marketing_contact_senders: marketing_contact_senders || [],
      };

      if (existing?.length) {
        const updated = await sr.entities.ChallengeRightsConfiguration.update(existing[0].id, data);
        return Response.json({ config: updated });
      } else {
        const created = await sr.entities.ChallengeRightsConfiguration.create(data);
        return Response.json({ config: created });
      }
    }

    if (action === "list_configs") {
      const all = await sr.entities.ChallengeRightsConfiguration.list("-created_date", 200).catch(() => []);
      return Response.json({ configs: all || [] });
    }

    // ── Rights summary for entry flow ───────────────────────────────────
    if (action === "get_rights_summary") {
      const { challenge_id } = body;
      if (!challenge_id) return Response.json({ error: "challenge_id required" }, { status: 400 });
      const summary = await buildRightsSummary(sr, challenge_id);
      return Response.json({ summary });
    }

    // ── Capture rights (entry flow consent) ─────────────────────────────
    if (action === "capture_rights") {
      const { challenge_id, entry_id, participant_name, participant_email, is_minor, scope_grants, marketing_contact_grants } = body;
      if (!challenge_id || !participant_name) {
        return Response.json({ error: "challenge_id and participant_name required" }, { status: 400 });
      }

      const config = await getRightsConfig(sr, challenge_id);

      let guardianConsentId = "";
      if (is_minor && entry_id) {
        const gc = await sr.entities.GuardianConsent.filter(
          { challenge_id: String(challenge_id), entry_id: String(entry_id) },
          "-created_date", 1
        ).catch(() => []);
        if (gc?.length) guardianConsentId = gc[0].id;
      }

      const existing = await sr.entities.ParticipantRightsRecord.filter(
        { entry_id: String(entry_id || "") }, "-created_date", 1
      ).catch(() => []);

      const data = {
        challenge_id: String(challenge_id),
        entry_id: String(entry_id || ""),
        participant_name,
        participant_email: participant_email || "",
        is_minor: !!is_minor,
        guardian_consent_id: guardianConsentId,
        scope_grants: scope_grants || [],
        marketing_contact_grants: marketing_contact_grants || [],
        status: "active",
        accepted_at: new Date().toISOString(),
        config_snapshot: config ? {
          music_policy: config.music_policy,
          third_party_policy: config.third_party_policy,
          included_scopes: (config.included_scope_versions || []).map((s) => s.scope_code),
        } : {},
      };

      if (existing?.length) {
        const updated = await sr.entities.ParticipantRightsRecord.update(existing[0].id, data);
        return Response.json({ record: updated });
      } else {
        const created = await sr.entities.ParticipantRightsRecord.create(data);
        return Response.json({ record: created });
      }
    }

    if (action === "get_rights_record") {
      const { entry_id } = body;
      if (!entry_id) return Response.json({ error: "entry_id required" }, { status: 400 });
      const record = await getRightsRecordForEntry(sr, entry_id);
      return Response.json({ record });
    }

    // ── Music declarations ───────────────────────────────────────────────
    if (action === "create_music_declaration") {
      const { challenge_id, entry_id, basis, track_title, track_artist, licence_evidence, notes } = body;
      if (!challenge_id || !basis) {
        return Response.json({ error: "challenge_id and basis required" }, { status: 400 });
      }

      let clearanceStatus = "not_required";
      if (basis === "commercial") clearanceStatus = "pending";
      else if (basis === "licensed" && licence_evidence) clearanceStatus = "cleared";

      const created = await sr.entities.MusicDeclaration.create({
        challenge_id: String(challenge_id),
        entry_id: String(entry_id || ""),
        basis,
        track_title: track_title || "",
        track_artist: track_artist || "",
        licence_evidence: licence_evidence || "",
        clearance_status: clearanceStatus,
        declared_at: new Date().toISOString(),
        notes: notes || "",
      });
      return Response.json({ declaration: created });
    }

    if (action === "clear_music_declaration") {
      if (user.role !== "admin") return Response.json({ error: "Admin only" }, { status: 403 });
      const { declaration_id, clearance_evidence } = body;
      if (!declaration_id) return Response.json({ error: "declaration_id required" }, { status: 400 });
      const updated = await sr.entities.MusicDeclaration.update(declaration_id, {
        clearance_status: "cleared",
        cleared_at: new Date().toISOString(),
        licence_evidence: clearance_evidence || "",
      });
      return Response.json({ declaration: updated });
    }

    // ── Media releases ──────────────────────────────────────────────────
    if (action === "create_media_release") {
      const { challenge_id, entry_id, subject_name, subject_type, method, release_file, scopes_released, notes } = body;
      if (!challenge_id || !subject_name) {
        return Response.json({ error: "challenge_id and subject_name required" }, { status: 400 });
      }
      const created = await sr.entities.MediaRelease.create({
        challenge_id: String(challenge_id),
        entry_id: String(entry_id || ""),
        subject_name,
        subject_type: subject_type || "adult",
        method: method || "written_consent",
        release_file: release_file || "",
        scopes_released: scopes_released || [],
        status: "pending",
        notes: notes || "",
      });
      return Response.json({ release: created });
    }

    if (action === "grant_media_release") {
      if (user.role !== "admin") return Response.json({ error: "Admin only" }, { status: 403 });
      const { release_id } = body;
      if (!release_id) return Response.json({ error: "release_id required" }, { status: 400 });
      const updated = await sr.entities.MediaRelease.update(release_id, {
        status: "granted",
        granted_at: new Date().toISOString(),
      });
      return Response.json({ release: updated });
    }

    // ── Marketing-use gate ───────────────────────────────────────────────
    if (action === "check_use") {
      const { entry_id, requested_scopes } = body;
      if (!entry_id || !requested_scopes) {
        return Response.json({ error: "entry_id and requested_scopes required" }, { status: 400 });
      }
      const result = await checkUseCleared(sr, entry_id, requested_scopes, user);
      return Response.json(result);
    }

    if (action === "log_use") {
      const { challenge_id, entry_id, participant_name, used_by, channel, description, url_or_file, scopes_relied_on } = body;
      if (!challenge_id || !used_by) {
        return Response.json({ error: "challenge_id and used_by required" }, { status: 400 });
      }

      if (entry_id && scopes_relied_on?.length) {
        const check = await checkUseCleared(sr, entry_id, scopes_relied_on, user);
        if (!check.cleared) {
          return Response.json({
            error: "Use not cleared",
            missing: check.missing,
            blocked: check.blocked,
            effective_scopes: check.effective_scopes,
          }, { status: 403 });
        }
      }

      const created = await sr.entities.MarketingUseLog.create({
        challenge_id: String(challenge_id),
        entry_id: String(entry_id || ""),
        participant_name: participant_name || "",
        used_by,
        channel: channel || "",
        description: description || "",
        url_or_file: url_or_file || "",
        scopes_relied_on: scopes_relied_on || [],
        checked_by: user.email || "",
        used_at: new Date().toISOString(),
        takedown_status: "not_required",
      });
      return Response.json({ log: created });
    }

    if (action === "list_use_logs") {
      const { challenge_id, entry_id } = body;
      const query = {};
      if (challenge_id) query.challenge_id = String(challenge_id);
      if (entry_id) query.entry_id = String(entry_id);
      const logs = await sr.entities.MarketingUseLog.filter(
        query, "-used_at", 200
      ).catch(() => []);
      return Response.json({ logs: logs || [] });
    }

    // ── Revocation ──────────────────────────────────────────────────────
    if (action === "revoke_scope") {
      if (user.role !== "admin") return Response.json({ error: "Admin only" }, { status: 403 });
      const { entry_id, scope_code } = body;
      if (!entry_id || !scope_code) {
        return Response.json({ error: "entry_id and scope_code required" }, { status: 400 });
      }
      const result = await revokeScope(sr, entry_id, scope_code, user);
      return Response.json(result);
    }

    // ── Effective scopes for an entry ───────────────────────────────────
    if (action === "get_effective_scopes") {
      const { entry_id } = body;
      if (!entry_id) return Response.json({ error: "entry_id required" }, { status: 400 });

      const entries = await sr.entities.Entry.filter(
        { id: String(entry_id) }, "-created_date", 1
      ).catch(() => []);
      const entry = entries?.[0];
      if (!entry) return Response.json({ error: "Entry not found" }, { status: 404 });

      const [rightsRecord, rightsConfig, musicDecls, mediaReleases] = await Promise.all([
        getRightsRecordForEntry(sr, entry_id),
        getRightsConfig(sr, entry.challenge_id),
        getMusicDeclarationsForEntry(sr, entry_id),
        getMediaReleasesForEntry(sr, entry_id),
      ]);
      const gc = entry.is_minor ? await getGuardianConsentForRights(sr, entry) : null;

      const result = computeEffectiveScopes(rightsRecord, rightsConfig, musicDecls, mediaReleases, gc);
      return Response.json(result);
    }

    return Response.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}