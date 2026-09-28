package com.fiftythree.challenges.guardian;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fiftythree.challenges.compliance.ComplianceAuditService;
import com.fiftythree.challenges.engine.EntryQueryRepository;
import com.fiftythree.challenges.entity.ConsentRequirementEntity;
import com.fiftythree.challenges.entity.ConsentRequirementRepository;
import com.fiftythree.challenges.entity.EntryEntity;
import com.fiftythree.challenges.entity.GuardianConsentEntity;
import com.fiftythree.challenges.security.CallerResolver;
import com.fiftythree.challenges.support.ApiErrors;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/**
 * The Java replacement for {@code guardianConsent}: the consent records
 * themselves, and the scope questions that depend on them.
 *
 * <p>Granting, declining and withdrawing are admin-only. Reading is open to any
 * signed-in caller, matching the original — these records are how the platform
 * proves what a guardian agreed to, so the write side is deliberately narrow.
 */
@RestController
public class GuardianConsentController {

  private static final Logger log = LoggerFactory.getLogger(GuardianConsentController.class);

  private final GuardianConsentQueryRepository consents;
  private final ConsentRequirementRepository requirements;
  private final EntryQueryRepository entries;
  private final GuardianConsentService rules;
  private final ComplianceAuditService audit;
  private final CallerResolver caller;
  private final ObjectMapper mapper;

  public GuardianConsentController(
      GuardianConsentQueryRepository consents,
      ConsentRequirementRepository requirements,
      EntryQueryRepository entries,
      GuardianConsentService rules,
      ComplianceAuditService audit,
      CallerResolver caller,
      ObjectMapper mapper) {
    this.consents = consents;
    this.requirements = requirements;
    this.entries = entries;
    this.rules = rules;
    this.audit = audit;
    this.caller = caller;
    this.mapper = mapper;
  }

  @PostMapping("/api/apps/{appId}/functions/guardianConsent")
  public ResponseEntity<?> handle(@RequestBody(required = false) Map<String, Object> body) {
    Map<String, Object> request = body == null ? Map.of() : body;
    String sessionToken = str(request.get("session_token"));
    String email = caller.email(sessionToken);
    if (email == null) {
      return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
    }
    boolean isAdmin = caller.isAdmin(sessionToken);
    String action = str(request.get("action"));

    try {
      return switch (action) {
        case "list_requirements" -> ResponseEntity.ok(
            Map.of("requirements", requirements.findAll()));
        case "create_requirement" -> isAdmin ? createRequirement(request) : adminOnly();
        // Admin-only. These return guardian names, addresses and participant
        // emails — contact details for children and their guardians. Any
        // signed-in account could read them, and list_consents takes a
        // challenge id, so the whole set was enumerable. The only caller is
        // ConsentPanel on the compliance admin page; get_consent has none.
        case "list_consents" -> isAdmin ? listConsents(request) : adminOnly();
        case "get_consent" -> isAdmin ? getConsent(request) : adminOnly();
        // Admin-only, like the reads beside it. No client calls this — the
        // real consent record is created by the entry flow — so leaving it
        // open only offered any signed-in account a way to fill a compliance
        // table with records naming children who never entered anything.
        case "create_consent" -> isAdmin ? createConsent(request) : adminOnly();
        case "grant_consent" -> isAdmin ? grant(request) : adminOnly();
        case "decline_consent" -> isAdmin ? decline(request) : adminOnly();
        case "withdraw_consent" -> isAdmin ? withdraw(request, email) : adminOnly();
        case "check_entry_visibility" -> checkVisibility(request);
        case "evaluate_minors_gate" -> evaluateMinorsGate(request);
        default -> ResponseEntity.badRequest().body(Map.of("error", "Unknown action"));
      };
    } catch (Exception e) {
      log.error("guardianConsent action '{}' failed", action, e);
      return ApiErrors.internal(e);
    }
  }

  private static ResponseEntity<?> adminOnly() {
    return ResponseEntity.status(403).body(Map.of("error", "Admin only"));
  }

  private ResponseEntity<?> createRequirement(Map<String, Object> request) {
    String name = str(request.get("name"));
    String method = str(request.get("method"));
    if (name.isEmpty() || method.isEmpty()) {
      return ResponseEntity.badRequest().body(Map.of("error", "name and method required"));
    }
    ConsentRequirementEntity r = new ConsentRequirementEntity();
    r.setId(newId());
    r.setName(name);
    r.setMethod(method);
    r.setClauseReference(str(request.get("clause_reference")));
    r.setDescription(str(request.get("description")));
    r.setSortOrder(toDouble(request.get("sort_order")));
    r.setCreatedDate(Instant.now());
    r.setUpdatedDate(Instant.now());
    r.setIsSample(false);
    return ResponseEntity.ok(Map.of("ok", true, "requirement", requirements.save(r)));
  }

  private ResponseEntity<?> listConsents(Map<String, Object> request) {
    String challengeId = str(request.get("challenge_id"));
    if (challengeId.isEmpty()) {
      return ResponseEntity.badRequest().body(Map.of("error", "challenge_id required"));
    }
    return ResponseEntity.ok(Map.of("consents", consents.findByChallenge(challengeId)));
  }

  private ResponseEntity<?> getConsent(Map<String, Object> request) {
    String id = str(request.get("consent_id"));
    if (id.isEmpty()) {
      return ResponseEntity.badRequest().body(Map.of("error", "consent_id required"));
    }
    GuardianConsentEntity consent = consents.findById(id).orElse(null);
    if (consent == null) {
      return ResponseEntity.status(404).body(Map.of("error", "Consent not found"));
    }
    return ResponseEntity.ok(Map.of("consent", consent));
  }

  private ResponseEntity<?> createConsent(Map<String, Object> request) {
    String challengeId = str(request.get("challenge_id"));
    String participantName = str(request.get("participant_name"));
    String guardianName = str(request.get("guardian_name"));
    String requirementId = str(request.get("requirement_id"));

    if (challengeId.isEmpty() || participantName.isEmpty()
        || guardianName.isEmpty() || requirementId.isEmpty()) {
      return ResponseEntity.badRequest().body(Map.of("error",
          "challenge_id, participant_name, guardian_name, requirement_id required"));
    }

    Instant now = Instant.now();
    GuardianConsentEntity c = new GuardianConsentEntity();
    c.setId(newId());
    c.setChallengeId(challengeId);
    c.setEntryId(str(request.get("entry_id")));
    c.setParticipantName(participantName);
    c.setParticipantEmail(str(request.get("participant_email")));
    c.setRequirementId(requirementId);
    c.setRequirementVersion(request.get("requirement_version") == null
        ? 1d : toDouble(request.get("requirement_version")));
    c.setGuardianName(guardianName);
    c.setGuardianRelationship(str(request.get("guardian_relationship")));
    c.setGuardianContact(str(request.get("guardian_contact")));
    c.setMethodUsed(firstNonBlank(
        str(request.get("method_used")), "guardian_email_verification"));
    // Always pending. A consent that arrives already granted would defeat the
    // verification step that makes it meaningful.
    c.setStatus("pending");
    c.setConsentWordingHash(str(request.get("consent_wording_hash")));
    c.setCreatedDate(now);
    c.setUpdatedDate(now);
    c.setIsSample(false);
    return ResponseEntity.ok(Map.of("ok", true, "consent", consents.save(c)));
  }

  private ResponseEntity<?> grant(Map<String, Object> request) {
    String id = str(request.get("consent_id"));
    if (id.isEmpty()) {
      return ResponseEntity.badRequest().body(Map.of("error", "consent_id required"));
    }
    GuardianConsentEntity consent = consents.findById(id).orElse(null);
    if (consent == null) {
      return ResponseEntity.status(404).body(Map.of("error", "Consent not found"));
    }

    Map<String, Object> scopes = asMap(request.get("scopes"));
    Instant now = Instant.now();
    consent.setStatus("granted");
    consent.setVerifiedAt(now);
    consent.setUpdatedDate(now);
    // Only scopes actually present in the request are changed. A scope omitted
    // keeps its stored value rather than being silently set to false — a
    // partial update must not revoke something a guardian already allowed.
    applyScopes(consent, scopes);
    consents.save(consent);

    // The entry's own status follows from the consent, so it is recomputed
    // rather than set independently — two places deciding the same thing is
    // how they come to disagree.
    if (!nz(consent.getEntryId()).isEmpty()) {
      entries.findById(consent.getEntryId()).ifPresent(e -> {
        e.setConsentStatus(rules.deriveEntryConsentStatus(consent));
        e.setUpdatedDate(now);
        entries.save(e);
      });
    }

    return ResponseEntity.ok(Map.of("ok", true, "consent_id", id, "status", "granted"));
  }

  private ResponseEntity<?> decline(Map<String, Object> request) {
    String id = str(request.get("consent_id"));
    if (id.isEmpty()) {
      return ResponseEntity.badRequest().body(Map.of("error", "consent_id required"));
    }
    GuardianConsentEntity consent = consents.findById(id).orElse(null);
    if (consent == null) {
      return ResponseEntity.status(404).body(Map.of("error", "Consent not found"));
    }
    consent.setStatus("declined");
    consent.setVerifiedAt(Instant.now());
    consent.setUpdatedDate(Instant.now());
    consents.save(consent);
    return ResponseEntity.ok(Map.of("ok", true, "consent_id", id, "status", "declined"));
  }

  /**
   * Withdrawal: the consent is revoked, the entry is taken out of public view,
   * and the decision is recorded.
   */
  private ResponseEntity<?> withdraw(Map<String, Object> request, String actorEmail) {
    String id = str(request.get("consent_id"));
    if (id.isEmpty()) {
      return ResponseEntity.badRequest().body(Map.of("error", "consent_id required"));
    }
    GuardianConsentEntity consent = consents.findById(id).orElse(null);
    if (consent == null) {
      return ResponseEntity.badRequest().body(Map.of("error", "Consent record not found"));
    }

    Instant now = Instant.now();
    String reason = str(request.get("reason"));
    consent.setStatus("withdrawn");
    consent.setWithdrawnAt(now);
    consent.setWithdrawalReason(reason);
    consent.setUpdatedDate(now);
    consents.save(consent);

    if (!nz(consent.getEntryId()).isEmpty()) {
      entries.findById(consent.getEntryId()).ifPresent(e -> {
        e.setConsentStatus("withdrawn");
        e.setUpdatedDate(now);
        entries.save(e);
      });
    }

    audit.event("finding_waived", nz(consent.getChallengeId()), "", actorEmail,
        "Guardian consent " + id + " withdrawn"
            + (reason.isBlank() ? "" : ": " + reason) + ".");

    return ResponseEntity.ok(Map.of("ok", true, "consent_id", id, "status", "withdrawn"));
  }

  private ResponseEntity<?> checkVisibility(Map<String, Object> request) {
    String entryId = str(request.get("entry_id"));
    if (entryId.isEmpty()) {
      return ResponseEntity.badRequest().body(Map.of("error", "entry_id required"));
    }
    EntryEntity entry = entries.findById(entryId).orElse(null);
    if (entry == null) {
      return ResponseEntity.status(404).body(Map.of("error", "Entry not found"));
    }
    GuardianConsentEntity consent = rules.forEntry(entry);
    boolean minor = Boolean.TRUE.equals(entry.getIsMinor());

    Map<String, Object> out = new LinkedHashMap<>();
    out.put("entry_id", entryId);
    out.put("is_minor", minor);
    out.put("consent_status", firstNonBlank(entry.getConsentStatus(), "pending_consent"));
    out.put("visible_to_public", rules.isVisibleToPublic(entry, consent));
    out.put("valid_for_judging", rules.isValidForJudging(entry, consent));
    out.put("display_name", minor
        ? GuardianConsentService.maskMinorName(entry.getCreatorName())
        : entry.getCreatorName());
    out.put("eligibility_bracket",
        minor ? GuardianConsentService.eligibilityBracket(entry) : null);
    out.put("prize_routes_to_guardian", rules.routesPrizeToGuardian(entry, consent));
    out.put("has_minimum_consent", rules.hasMinimumConsent(consent));
    return ResponseEntity.ok(out);
  }

  /**
   * Whether a challenge may accept minors at all.
   *
   * <p>At least one active consent requirement must exist — without one there
   * is no defined wording for a guardian to agree to, so consent could not be
   * recorded meaningfully.
   */
  private ResponseEntity<?> evaluateMinorsGate(Map<String, Object> request) {
    if (str(request.get("challenge_id")).isEmpty()) {
      return ResponseEntity.badRequest().body(Map.of("error", "challenge_id required"));
    }
    List<Map<String, Object>> missing = new ArrayList<>();
    boolean anyActive = requirements.findAll().stream()
        .anyMatch(r -> Boolean.TRUE.equals(r.getIsActive()));
    if (!anyActive) {
      missing.add(Map.of(
          "check", "consent_requirement",
          "description", "At least one active ConsentRequirement must exist."));
    }
    return ResponseEntity.ok(Map.of("evaluation",
        Map.of("can_pass", missing.isEmpty(), "missing", missing)));
  }

  /** Sets only the scopes present in the request. */
  private void applyScopes(GuardianConsentEntity consent, Map<String, Object> scopes) {
    for (String scope : GuardianConsentService.ALL_SCOPES) {
      if (!scopes.containsKey(scope)) {
        continue;
      }
      boolean value = truthy(scopes.get(scope));
      switch (scope) {
        case "scopes_entering_challenge" -> consent.setScopesEnteringChallenge(value);
        case "scopes_terms_acceptance" -> consent.setScopesTermsAcceptance(value);
        case "scopes_personal_info_processing" -> consent.setScopesPersonalInfoProcessing(value);
        case "scopes_public_display_name" -> consent.setScopesPublicDisplayName(value);
        case "scopes_public_display_age_bracket" -> consent.setScopesPublicDisplayAgeBracket(value);
        case "scopes_publication_of_entry_media" -> consent.setScopesPublicationOfEntryMedia(value);
        case "scopes_promotional_reuse" -> consent.setScopesPromotionalReuse(value);
        case "scopes_direct_communication_with_minor" ->
            consent.setScopesDirectCommunicationWithMinor(value);
        case "scopes_public_voting_participation" ->
            consent.setScopesPublicVotingParticipation(value);
        case "scopes_prize_acceptance_payment" -> consent.setScopesPrizeAcceptancePayment(value);
        case "scopes_event_travel_attendance" -> consent.setScopesEventTravelAttendance(value);
        case "scopes_appears_in_entry" -> consent.setScopesAppearsInEntry(value);
        default -> { /* unreachable: the list is fixed */ }
      }
    }
  }

  @SuppressWarnings("unchecked")
  private static Map<String, Object> asMap(Object v) {
    return v instanceof Map<?, ?> m ? (Map<String, Object>) m : Map.of();
  }

  private static boolean truthy(Object v) {
    return Boolean.TRUE.equals(v) || "true".equalsIgnoreCase(String.valueOf(v));
  }

  private static double toDouble(Object v) {
    try {
      return v == null ? 0 : Double.parseDouble(String.valueOf(v));
    } catch (NumberFormatException e) {
      return 0;
    }
  }

  private static String firstNonBlank(String... values) {
    for (String v : values) {
      if (v != null && !v.isBlank()) {
        return v;
      }
    }
    return "";
  }

  private static String nz(String v) {
    return v == null ? "" : v;
  }

  private static String str(Object v) {
    return v == null ? "" : String.valueOf(v);
  }

  private static String newId() {
    return UUID.randomUUID().toString().replace("-", "").substring(0, 24);
  }
}
