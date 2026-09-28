package com.fiftythree.challenges.rights;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fiftythree.challenges.compliance.RightsConfigurationQueryRepository;
import com.fiftythree.challenges.entity.ChallengeRightsConfigurationEntity;
import com.fiftythree.challenges.entity.EntryEntity;
import com.fiftythree.challenges.entity.EntryRepository;
import com.fiftythree.challenges.entity.MarketingUseLogEntity;
import com.fiftythree.challenges.entity.MediaReleaseEntity;
import com.fiftythree.challenges.entity.MusicDeclarationEntity;
import com.fiftythree.challenges.entity.ParticipantRightsRecordEntity;
import com.fiftythree.challenges.entity.RightsGrantTemplateEntity;
import com.fiftythree.challenges.guardian.GuardianConsentQueryRepository;
import com.fiftythree.challenges.security.CallerResolver;
import com.fiftythree.challenges.user.UserRepository;
import com.fiftythree.challenges.support.ApiErrors;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Supplier;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/**
 * The Java replacement for {@code rightsManager}: what participants licence to
 * the platform, and the gate that decides whether a marketing use is allowed.
 *
 * <p>The action worth understanding is {@code log_use}. It re-runs the use
 * check before writing, so a use cannot be recorded as cleared unless it
 * genuinely is — and every cleared use produces a log entry, including uses by
 * hosts. That log is what makes revocation possible afterwards: withdrawing a
 * scope turns the matching logged uses into takedown tasks, which only works
 * if the uses were recorded in the first place.
 */
@RestController
public class RightsManagerController {

  private static final Logger log = LoggerFactory.getLogger(RightsManagerController.class);

  private final RightsService rights;
  private final RightsTemplateQueryRepository templates;
  private final RightsConfigurationQueryRepository configs;
  private final RightsConfigQueryRepository allConfigs;
  private final RightsRecordQueryRepository records;
  private final MusicDeclarationQueryRepository music;
  private final MediaReleaseQueryRepository media;
  private final MarketingUseLogQueryRepository useLogs;
  private final GuardianConsentQueryRepository guardianConsents;
  private final EntryRepository entries;
  private final CallerResolver caller;
  private final UserRepository users;
  private final ObjectMapper mapper;

  public RightsManagerController(
      RightsService rights,
      RightsTemplateQueryRepository templates,
      RightsConfigurationQueryRepository configs,
      RightsConfigQueryRepository allConfigs,
      RightsRecordQueryRepository records,
      MusicDeclarationQueryRepository music,
      MediaReleaseQueryRepository media,
      MarketingUseLogQueryRepository useLogs,
      GuardianConsentQueryRepository guardianConsents,
      EntryRepository entries,
      CallerResolver caller,
      UserRepository users,
      ObjectMapper mapper) {
    this.rights = rights;
    this.templates = templates;
    this.configs = configs;
    this.allConfigs = allConfigs;
    this.records = records;
    this.music = music;
    this.media = media;
    this.useLogs = useLogs;
    this.guardianConsents = guardianConsents;
    this.entries = entries;
    this.caller = caller;
    this.users = users;
    this.mapper = mapper;
  }

  @PostMapping("/api/apps/{appId}/functions/rightsManager")
  public ResponseEntity<?> handle(@RequestBody(required = false) Map<String, Object> body) {
    Map<String, Object> request = body == null ? Map.of() : body;
    String sessionToken = str(request.get("session_token"));
    String email = caller.email(sessionToken);
    if (email == null) {
      return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
    }
    boolean isAdmin = caller.isAdmin(sessionToken);
    String actorId = users.findIdByEmail(email).orElse("");
    String action = str(request.get("action"));

    try {
      return switch (action == null ? "" : action) {
        case "list_templates" -> ResponseEntity.ok(Map.of("templates",
            templates.findCurrent().stream().map(this::templateJson).toList()));
        case "list_configs" -> ResponseEntity.ok(Map.of("configs",
            allConfigs.findAllNewestFirst().stream().map(rights::configJson).toList()));
        case "get_config" -> getConfig(request);
        case "get_rights_summary" -> rightsSummary(request);
        case "capture_rights" -> captureRights(request);
        case "get_rights_record" -> getRightsRecord(request);
        case "create_music_declaration" -> createMusicDeclaration(request);
        case "create_media_release" -> createMediaRelease(request);
        case "check_use" -> checkUse(request);
        case "log_use" -> logUse(request, email);
        case "list_use_logs" -> listUseLogs(request);
        case "get_effective_scopes" -> effectiveScopes(request);

        case "sign_template" -> admin(isAdmin, () -> signTemplate(request));
        case "save_config" -> admin(isAdmin, () -> saveConfig(request));
        case "clear_music_declaration" -> admin(isAdmin, () -> clearMusic(request));
        case "grant_media_release" -> admin(isAdmin, () -> grantMediaRelease(request));
        case "revoke_scope" -> admin(isAdmin, () -> revokeScope(request, actorId, email));

        default -> ResponseEntity.status(400).body(Map.of("error", "Unknown action"));
      };
    } catch (Exception e) {
      log.error("rightsManager action '{}' failed", action, e);
      return ApiErrors.internal(e);
    }
  }

  private ResponseEntity<?> admin(boolean isAdmin, Supplier<ResponseEntity<?>> handler) {
    return isAdmin ? handler.get() : ResponseEntity.status(403).body(Map.of("error", "Admin only"));
  }

  // ----------------------------------------------------------- templates

  private ResponseEntity<?> signTemplate(Map<String, Object> request) {
    String templateId = str(request.get("template_id"));
    String reviewer = str(request.get("reviewer"));
    String date = str(request.get("date"));
    String reference = str(request.get("reference"));
    if (templateId == null || reviewer == null || date == null || reference == null) {
      return ResponseEntity.status(400).body(
          Map.of("error", "template_id, reviewer, date, reference required"));
    }
    Optional<RightsGrantTemplateEntity> found = templates.findById(templateId);
    if (found.isEmpty()) {
      return ResponseEntity.status(404).body(Map.of("error", "Template not found"));
    }

    RightsGrantTemplateEntity template = found.get();
    template.setLegalSignoff(rights.write(Map.of(
        "reviewer", reviewer, "date", date, "reference", reference)));
    template.setUpdatedDate(Instant.now());
    templates.save(template);

    return ResponseEntity.ok(Map.of("template", templateJson(template)));
  }

  // -------------------------------------------------------- configuration

  private ResponseEntity<?> getConfig(Map<String, Object> request) {
    String challengeId = str(request.get("challenge_id"));
    if (challengeId == null) {
      return ResponseEntity.status(400).body(Map.of("error", "challenge_id required"));
    }
    Map<String, Object> out = new LinkedHashMap<>();
    out.put("config", rights.config(challengeId).map(rights::configJson).orElse(null));
    return ResponseEntity.ok(out);
  }

  private ResponseEntity<?> saveConfig(Map<String, Object> request) {
    String challengeId = str(request.get("challenge_id"));
    if (challengeId == null) {
      return ResponseEntity.status(400).body(Map.of("error", "challenge_id required"));
    }

    Instant now = Instant.now();
    ChallengeRightsConfigurationEntity config = rights.config(challengeId)
        .orElseGet(() -> {
          ChallengeRightsConfigurationEntity fresh = new ChallengeRightsConfigurationEntity();
          fresh.setId(newId());
          fresh.setChallengeId(challengeId);
          fresh.setCreatedDate(now);
          fresh.setIsSample(false);
          return fresh;
        });

    config.setIncludedScopeVersions(writeList(request.get("included_scope_versions")));
    // The defaults are the restrictive ones: original music only, and no third
    // parties in shot. A configuration saved without stating a policy must not
    // end up permitting more than the one it replaced.
    config.setMusicPolicy(strOr(request.get("music_policy"), "original_or_licensed_only"));
    config.setThirdPartyPolicy(strOr(request.get("third_party_policy"), "none_permitted"));
    config.setSponsorUsePeriod(orEmpty(str(request.get("sponsor_use_period"))));
    config.setMarketingContactSenders(writeList(request.get("marketing_contact_senders")));
    config.setUpdatedDate(now);
    configs.save(config);

    return ResponseEntity.ok(Map.of("config", rights.configJson(config)));
  }

  private ResponseEntity<?> rightsSummary(Map<String, Object> request) {
    String challengeId = str(request.get("challenge_id"));
    if (challengeId == null) {
      return ResponseEntity.status(400).body(Map.of("error", "challenge_id required"));
    }
    Map<String, Object> out = new LinkedHashMap<>();
    out.put("summary", rights.buildRightsSummary(challengeId));
    return ResponseEntity.ok(out);
  }

  // -------------------------------------------------------------- consent

  private ResponseEntity<?> captureRights(Map<String, Object> request) {
    String challengeId = str(request.get("challenge_id"));
    String participantName = str(request.get("participant_name"));
    if (challengeId == null || participantName == null) {
      return ResponseEntity.status(400).body(
          Map.of("error", "challenge_id and participant_name required"));
    }
    String entryId = orEmpty(str(request.get("entry_id")));
    boolean isMinor = Boolean.TRUE.equals(request.get("is_minor"));

    String guardianConsentId = "";
    if (isMinor && !entryId.isEmpty()) {
      guardianConsentId = guardianConsents.findForEntry(challengeId, entryId).stream()
          .findFirst()
          .map(c -> c.getId())
          .orElse("");
    }

    ChallengeRightsConfigurationEntity config = rights.config(challengeId).orElse(null);
    Instant now = Instant.now();

    ParticipantRightsRecordEntity record = rights.recordForEntry(entryId)
        .orElseGet(() -> {
          ParticipantRightsRecordEntity fresh = new ParticipantRightsRecordEntity();
          fresh.setId(newId());
          fresh.setCreatedDate(now);
          fresh.setIsSample(false);
          return fresh;
        });

    record.setChallengeId(challengeId);
    record.setEntryId(entryId);
    record.setParticipantName(participantName);
    record.setParticipantEmail(orEmpty(str(request.get("participant_email"))));
    record.setIsMinor(isMinor);
    record.setGuardianConsentId(guardianConsentId);
    record.setScopeGrants(writeList(request.get("scope_grants")));
    record.setMarketingContactGrants(writeList(request.get("marketing_contact_grants")));
    record.setStatus("active");
    record.setAcceptedAt(now);
    // A snapshot of what the challenge was offering at the moment of consent.
    // The configuration can change afterwards; what someone agreed to cannot.
    record.setConfigSnapshot(rights.write(configSnapshot(config)));
    record.setUpdatedDate(now);
    records.save(record);

    return ResponseEntity.ok(Map.of("record", recordJson(record)));
  }

  private Map<String, Object> configSnapshot(ChallengeRightsConfigurationEntity config) {
    if (config == null) {
      return Map.of();
    }
    Map<String, Object> snapshot = new LinkedHashMap<>();
    snapshot.put("music_policy", config.getMusicPolicy());
    snapshot.put("third_party_policy", config.getThirdPartyPolicy());
    snapshot.put("included_scopes", rights.nodes(config.getIncludedScopeVersions()).stream()
        .map(s -> s.path("scope_code").asText(""))
        .toList());
    return snapshot;
  }

  private ResponseEntity<?> getRightsRecord(Map<String, Object> request) {
    String entryId = str(request.get("entry_id"));
    if (entryId == null) {
      return ResponseEntity.status(400).body(Map.of("error", "entry_id required"));
    }
    Map<String, Object> out = new LinkedHashMap<>();
    out.put("record", rights.recordForEntry(entryId).map(this::recordJson).orElse(null));
    return ResponseEntity.ok(out);
  }

  // ---------------------------------------------------------------- music

  private ResponseEntity<?> createMusicDeclaration(Map<String, Object> request) {
    String challengeId = str(request.get("challenge_id"));
    String basis = str(request.get("basis"));
    if (challengeId == null || basis == null) {
      return ResponseEntity.status(400).body(Map.of("error", "challenge_id and basis required"));
    }
    String licence = orEmpty(str(request.get("licence_evidence")));

    // Commercial music starts pending and stays pending until someone records
    // the clearance. Licensed music with evidence attached is cleared on the
    // spot; licensed music without it is not, which is the case that matters.
    String clearance = "not_required";
    if ("commercial".equals(basis)) {
      clearance = "pending";
    } else if ("licensed".equals(basis) && !licence.isEmpty()) {
      clearance = "cleared";
    }

    Instant now = Instant.now();
    MusicDeclarationEntity declaration = new MusicDeclarationEntity();
    declaration.setId(newId());
    declaration.setChallengeId(challengeId);
    declaration.setEntryId(orEmpty(str(request.get("entry_id"))));
    declaration.setBasis(basis);
    declaration.setTrackTitle(orEmpty(str(request.get("track_title"))));
    declaration.setTrackArtist(orEmpty(str(request.get("track_artist"))));
    declaration.setLicenceEvidence(licence);
    declaration.setClearanceStatus(clearance);
    declaration.setDeclaredAt(now);
    declaration.setNotes(orEmpty(str(request.get("notes"))));
    declaration.setCreatedDate(now);
    declaration.setUpdatedDate(now);
    declaration.setIsSample(false);
    music.save(declaration);

    return ResponseEntity.ok(Map.of("declaration", musicJson(declaration)));
  }

  private ResponseEntity<?> clearMusic(Map<String, Object> request) {
    String declarationId = str(request.get("declaration_id"));
    if (declarationId == null) {
      return ResponseEntity.status(400).body(Map.of("error", "declaration_id required"));
    }
    Optional<MusicDeclarationEntity> found = music.findById(declarationId);
    if (found.isEmpty()) {
      return ResponseEntity.status(404).body(Map.of("error", "Declaration not found"));
    }

    MusicDeclarationEntity declaration = found.get();
    declaration.setClearanceStatus("cleared");
    declaration.setClearedAt(Instant.now());
    declaration.setLicenceEvidence(orEmpty(str(request.get("clearance_evidence"))));
    declaration.setUpdatedDate(Instant.now());
    music.save(declaration);

    return ResponseEntity.ok(Map.of("declaration", musicJson(declaration)));
  }

  // ------------------------------------------------------- media releases

  private ResponseEntity<?> createMediaRelease(Map<String, Object> request) {
    String challengeId = str(request.get("challenge_id"));
    String subjectName = str(request.get("subject_name"));
    if (challengeId == null || subjectName == null) {
      return ResponseEntity.status(400).body(
          Map.of("error", "challenge_id and subject_name required"));
    }

    Instant now = Instant.now();
    MediaReleaseEntity release = new MediaReleaseEntity();
    release.setId(newId());
    release.setChallengeId(challengeId);
    release.setEntryId(orEmpty(str(request.get("entry_id"))));
    release.setSubjectName(subjectName);
    release.setSubjectType(strOr(request.get("subject_type"), "adult"));
    release.setMethod(strOr(request.get("method"), "written_consent"));
    release.setReleaseFile(orEmpty(str(request.get("release_file"))));
    release.setScopesReleased(writeList(request.get("scopes_released")));
    // Pending on creation. Until someone grants it, the entry is blocked from
    // every promotional scope — recording that a release exists is not the
    // same as having it.
    release.setStatus("pending");
    release.setNotes(orEmpty(str(request.get("notes"))));
    release.setCreatedDate(now);
    release.setUpdatedDate(now);
    release.setIsSample(false);
    media.save(release);

    return ResponseEntity.ok(Map.of("release", releaseJson(release)));
  }

  private ResponseEntity<?> grantMediaRelease(Map<String, Object> request) {
    String releaseId = str(request.get("release_id"));
    if (releaseId == null) {
      return ResponseEntity.status(400).body(Map.of("error", "release_id required"));
    }
    Optional<MediaReleaseEntity> found = media.findById(releaseId);
    if (found.isEmpty()) {
      return ResponseEntity.status(404).body(Map.of("error", "Release not found"));
    }

    MediaReleaseEntity release = found.get();
    release.setStatus("granted");
    release.setGrantedAt(Instant.now());
    release.setUpdatedDate(Instant.now());
    media.save(release);

    return ResponseEntity.ok(Map.of("release", releaseJson(release)));
  }

  // ------------------------------------------------------------- use gate

  private ResponseEntity<?> checkUse(Map<String, Object> request) {
    String entryId = str(request.get("entry_id"));
    List<String> requested = stringList(request.get("requested_scopes"));
    if (entryId == null || request.get("requested_scopes") == null) {
      return ResponseEntity.status(400).body(
          Map.of("error", "entry_id and requested_scopes required"));
    }
    EntryEntity entry = entries.findById(entryId).orElse(null);
    return ResponseEntity.ok(rights.checkUse(entry, requested).toMap());
  }

  private ResponseEntity<?> logUse(Map<String, Object> request, String email) {
    String challengeId = str(request.get("challenge_id"));
    String usedBy = str(request.get("used_by"));
    if (challengeId == null || usedBy == null) {
      return ResponseEntity.status(400).body(
          Map.of("error", "challenge_id and used_by required"));
    }
    String entryId = orEmpty(str(request.get("entry_id")));
    List<String> relied = stringList(request.get("scopes_relied_on"));

    // Re-checked here rather than trusting an earlier check_use call: the
    // clearance could have changed in between, and this is the write that
    // creates the record saying the use was authorised.
    if (!entryId.isEmpty() && !relied.isEmpty()) {
      EntryEntity entry = entries.findById(entryId).orElse(null);
      RightsService.UseCheck check = rights.checkUse(entry, relied);
      if (!check.cleared()) {
        Map<String, Object> refusal = new LinkedHashMap<>();
        refusal.put("error", "Use not cleared");
        refusal.put("missing", check.missing());
        refusal.put("blocked", check.blocked());
        refusal.put("effective_scopes", check.effectiveScopes());
        return ResponseEntity.status(403).body(refusal);
      }
    }

    Instant now = Instant.now();
    MarketingUseLogEntity entry = new MarketingUseLogEntity();
    entry.setId(newId());
    entry.setChallengeId(challengeId);
    entry.setEntryId(entryId);
    entry.setParticipantName(orEmpty(str(request.get("participant_name"))));
    entry.setUsedBy(usedBy);
    entry.setChannel(orEmpty(str(request.get("channel"))));
    entry.setDescription(orEmpty(str(request.get("description"))));
    entry.setUrlOrFile(orEmpty(str(request.get("url_or_file"))));
    entry.setScopesReliedOn(writeList(request.get("scopes_relied_on")));
    entry.setCheckedBy(email);
    entry.setUsedAt(now);
    entry.setTakedownStatus("not_required");
    entry.setCreatedDate(now);
    entry.setUpdatedDate(now);
    entry.setIsSample(false);
    useLogs.save(entry);

    return ResponseEntity.ok(Map.of("log", useLogJson(entry)));
  }

  private ResponseEntity<?> listUseLogs(Map<String, Object> request) {
    String challengeId = str(request.get("challenge_id"));
    String entryId = str(request.get("entry_id"));

    List<MarketingUseLogEntity> rows;
    if (challengeId != null && entryId != null) {
      rows = useLogs.findByChallengeAndEntry(challengeId, entryId);
    } else if (challengeId != null) {
      rows = useLogs.findByChallenge(challengeId);
    } else if (entryId != null) {
      rows = useLogs.findByEntry(entryId);
    } else {
      rows = useLogs.findAllNewestFirst();
    }
    return ResponseEntity.ok(Map.of("logs", rows.stream().map(this::useLogJson).toList()));
  }

  private ResponseEntity<?> revokeScope(
      Map<String, Object> request, String actorId, String email) {

    String entryId = str(request.get("entry_id"));
    String scopeCode = str(request.get("scope_code"));
    if (entryId == null || scopeCode == null) {
      return ResponseEntity.status(400).body(Map.of("error", "entry_id and scope_code required"));
    }
    return ResponseEntity.ok(rights.revokeScope(entryId, scopeCode, actorId, email).toMap());
  }

  private ResponseEntity<?> effectiveScopes(Map<String, Object> request) {
    String entryId = str(request.get("entry_id"));
    if (entryId == null) {
      return ResponseEntity.status(400).body(Map.of("error", "entry_id required"));
    }
    Optional<EntryEntity> found = entries.findById(entryId);
    if (found.isEmpty()) {
      return ResponseEntity.status(404).body(Map.of("error", "Entry not found"));
    }
    EntryEntity entry = found.get();

    return ResponseEntity.ok(rights.computeEffectiveScopes(
        rights.recordForEntry(entryId).orElse(null),
        rights.config(orEmpty(entry.getChallengeId())).orElse(null),
        music.findByEntry(entryId),
        media.findByEntry(entryId),
        rights.guardianConsentFor(entry).orElse(null)).toMap());
  }

  // -------------------------------------------------------------- shapes

  private Map<String, Object> templateJson(RightsGrantTemplateEntity t) {
    Map<String, Object> out = new LinkedHashMap<>();
    out.put("id", t.getId());
    out.put("scope_code", t.getScopeCode());
    out.put("tier", t.getTier());
    out.put("display_name", t.getDisplayName());
    out.put("description", t.getDescription());
    out.put("clause_reference", t.getClauseReference());
    out.put("default_duration", t.getDefaultDuration());
    out.put("default_territory", t.getDefaultTerritory());
    out.put("default_attribution", t.getDefaultAttribution());
    out.put("default_sublicensable", t.getDefaultSublicensable());
    out.put("default_revocable", t.getDefaultRevocable());
    out.put("version", t.getVersion());
    out.put("legal_signoff", rights.node(t.getLegalSignoff()));
    out.put("is_current", t.getIsCurrent());
    out.put("effective_from", iso(t.getEffectiveFrom()));
    out.put("retirement_date", iso(t.getRetirementDate()));
    out.put("sort_order", t.getSortOrder());
    // Computed rather than stored: the consent screen needs to know which
    // templates are actually offerable.
    out.put("signed", rights.isSigned(t));
    out.put("expired", rights.isExpired(t));
    return out;
  }

  private Map<String, Object> recordJson(ParticipantRightsRecordEntity r) {
    Map<String, Object> out = new LinkedHashMap<>();
    out.put("id", r.getId());
    out.put("challenge_id", r.getChallengeId());
    out.put("entry_id", r.getEntryId());
    out.put("participant_name", r.getParticipantName());
    out.put("participant_email", r.getParticipantEmail());
    out.put("is_minor", r.getIsMinor());
    out.put("guardian_consent_id", r.getGuardianConsentId());
    out.put("scope_grants", rights.node(r.getScopeGrants()));
    out.put("marketing_contact_grants", rights.node(r.getMarketingContactGrants()));
    out.put("status", r.getStatus());
    out.put("accepted_at", iso(r.getAcceptedAt()));
    out.put("revoked_at", iso(r.getRevokedAt()));
    out.put("config_snapshot", rights.node(r.getConfigSnapshot()));
    out.put("created_date", iso(r.getCreatedDate()));
    return out;
  }

  private Map<String, Object> musicJson(MusicDeclarationEntity m) {
    Map<String, Object> out = new LinkedHashMap<>();
    out.put("id", m.getId());
    out.put("challenge_id", m.getChallengeId());
    out.put("entry_id", m.getEntryId());
    out.put("basis", m.getBasis());
    out.put("track_title", m.getTrackTitle());
    out.put("track_artist", m.getTrackArtist());
    out.put("licence_evidence", m.getLicenceEvidence());
    out.put("clearance_status", m.getClearanceStatus());
    out.put("declared_at", iso(m.getDeclaredAt()));
    out.put("cleared_at", iso(m.getClearedAt()));
    out.put("notes", m.getNotes());
    return out;
  }

  private Map<String, Object> releaseJson(MediaReleaseEntity m) {
    Map<String, Object> out = new LinkedHashMap<>();
    out.put("id", m.getId());
    out.put("challenge_id", m.getChallengeId());
    out.put("entry_id", m.getEntryId());
    out.put("subject_name", m.getSubjectName());
    out.put("subject_type", m.getSubjectType());
    out.put("guardian_consent_id", m.getGuardianConsentId());
    out.put("scopes_released", rights.node(m.getScopesReleased()));
    out.put("method", m.getMethod());
    out.put("release_file", m.getReleaseFile());
    out.put("status", m.getStatus());
    out.put("granted_at", iso(m.getGrantedAt()));
    out.put("withdrawn_at", iso(m.getWithdrawnAt()));
    out.put("notes", m.getNotes());
    return out;
  }

  private Map<String, Object> useLogJson(MarketingUseLogEntity l) {
    Map<String, Object> out = new LinkedHashMap<>();
    out.put("id", l.getId());
    out.put("challenge_id", l.getChallengeId());
    out.put("entry_id", l.getEntryId());
    out.put("participant_name", l.getParticipantName());
    out.put("used_by", l.getUsedBy());
    out.put("channel", l.getChannel());
    out.put("description", l.getDescription());
    out.put("url_or_file", l.getUrlOrFile());
    out.put("scopes_relied_on", rights.node(l.getScopesReliedOn()));
    out.put("checked_by", l.getCheckedBy());
    out.put("used_at", iso(l.getUsedAt()));
    out.put("takedown_status", l.getTakedownStatus());
    out.put("takedown_at", iso(l.getTakedownAt()));
    out.put("notes", l.getNotes());
    return out;
  }

  // ------------------------------------------------------------- helpers

  private String writeList(Object value) {
    return rights.write(value instanceof List<?> list ? list : List.of());
  }

  private static List<String> stringList(Object value) {
    if (!(value instanceof List<?> list)) {
      return List.of();
    }
    return list.stream().map(String::valueOf).toList();
  }

  private static String iso(Instant value) {
    return value == null ? null : value.toString();
  }

  private static String strOr(Object value, String fallback) {
    String text = str(value);
    return text == null ? fallback : text;
  }

  private static String orEmpty(String value) {
    return value == null ? "" : value;
  }

  private static String str(Object value) {
    if (value == null) {
      return null;
    }
    String text = String.valueOf(value).trim();
    return text.isEmpty() ? null : text;
  }

  private static String newId() {
    return UUID.randomUUID().toString().replace("-", "").substring(0, 24);
  }
}
