package com.fiftythree.challenges.compliance;

import com.fiftythree.challenges.entity.ComplianceAssessmentFindingEntity;
import com.fiftythree.challenges.entity.PermitActionEntity;
import com.fiftythree.challenges.entity.PermitOrAuthorityEntity;
import com.fiftythree.challenges.entity.RegulatoryRuleVersionRepository;
import com.fiftythree.challenges.security.CallerResolver;
import com.fiftythree.challenges.support.JsonColumn;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fiftythree.challenges.support.ApiErrors;
import java.time.Instant;
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
 * The Java replacement for {@code permitTracker}: trade-promotion permits,
 * the actions they require, and the compliance findings they satisfy.
 */
@RestController
public class PermitTrackerController {

  private static final Logger log = LoggerFactory.getLogger(PermitTrackerController.class);

  /** Fields an admin may change on an existing instrument. */
  private static final List<String> UPDATABLE = List.of(
      "status", "effective_date", "expiry_date", "covered_challenges",
      "fee", "notes", "documents", "assigned_to");

  private final PermitQueryRepository permits;
  private final PermitActionQueryRepository actions;
  private final FindingQueryRepository findings;
  private final RegulatoryRuleVersionRepository ruleVersions;
  private final PermitService service;
  private final CallerResolver caller;
  private final JsonColumn json;
  private final ObjectMapper mapper;

  public PermitTrackerController(
      PermitQueryRepository permits,
      PermitActionQueryRepository actions,
      FindingQueryRepository findings,
      RegulatoryRuleVersionRepository ruleVersions,
      PermitService service,
      CallerResolver caller,
      JsonColumn json,
      ObjectMapper mapper) {
    this.permits = permits;
    this.actions = actions;
    this.findings = findings;
    this.ruleVersions = ruleVersions;
    this.service = service;
    this.caller = caller;
    this.json = json;
    this.mapper = mapper;
  }

  @PostMapping("/api/apps/{appId}/functions/permitTracker")
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
        case "list_permits" -> listPermits(request);
        case "list_actions" -> listActions(request);
        case "create_permit" -> isAdmin ? createPermit(request) : adminOnly();
        case "update_permit" -> isAdmin ? updatePermit(request) : adminOnly();
        case "create_action" -> isAdmin ? createAction(request) : adminOnly();
        case "complete_action" -> isAdmin ? completeAction(request) : adminOnly();
        case "link_permit_to_finding" -> isAdmin ? linkToFinding(request, email) : adminOnly();
        case "expire_check" -> isAdmin
            ? ResponseEntity.ok(service.checkExpiring(email)) : adminOnly();
        case "check_nt_cross_recognition" -> isAdmin ? crossRecognition(request, email) : adminOnly();
        default -> ResponseEntity.badRequest().body(Map.of("error", "Unknown action"));
      };
    } catch (Exception e) {
      log.error("permitTracker action '{}' failed", action, e);
      return ApiErrors.internal(e);
    }
  }

  private static ResponseEntity<?> adminOnly() {
    return ResponseEntity.status(403).body(Map.of("error", "Admin only"));
  }

  private ResponseEntity<?> listPermits(Map<String, Object> request) {
    String challengeId = str(request.get("challenge_id"));
    List<PermitOrAuthorityEntity> all = permits.findAllNewestFirst();
    if (challengeId.isEmpty()) {
      return ResponseEntity.ok(Map.of("permits", all));
    }
    // An instrument with no coverage list covers every challenge.
    return ResponseEntity.ok(Map.of("permits", all.stream()
        .filter(p -> {
          List<String> covered = json.stringList(p.getCoveredChallenges());
          return covered.isEmpty() || covered.contains(challengeId);
        })
        .toList()));
  }

  private ResponseEntity<?> listActions(Map<String, Object> request) {
    String challengeId = str(request.get("challenge_id"));
    return ResponseEntity.ok(Map.of("actions", challengeId.isEmpty()
        ? actions.findAllNewestFirst()
        : actions.findByChallenge(challengeId)));
  }

  private ResponseEntity<?> createPermit(Map<String, Object> request) {
    String jurisdiction = str(request.get("jurisdiction_code"));
    String instrumentType = str(request.get("instrument_type"));
    String holder = str(request.get("holder"));
    String reference = str(request.get("reference_number"));
    if (jurisdiction.isEmpty() || instrumentType.isEmpty()
        || holder.isEmpty() || reference.isEmpty()) {
      return ResponseEntity.badRequest().body(Map.of("error",
          "jurisdiction_code, instrument_type, holder, reference_number required"));
    }

    Instant now = Instant.now();
    PermitOrAuthorityEntity p = new PermitOrAuthorityEntity();
    p.setId(newId());
    p.setJurisdictionCode(jurisdiction);
    p.setInstrumentType(instrumentType);
    p.setHolder(holder);
    p.setHolderEntityName(str(request.get("holder_entity_name")));
    p.setReferenceNumber(reference);
    p.setIssuedDate(toDate(request.get("issued_date")));
    p.setEffectiveDate(toDate(request.get("effective_date")));
    p.setExpiryDate(toDate(request.get("expiry_date")));
    // Defaults to "applied", never to a status that would make it usable.
    p.setStatus(firstNonBlank(str(request.get("status")), "applied"));
    p.setCoveredChallenges(writeJson(request.get("covered_challenges")));
    p.setFee(toDouble(request.get("fee")));
    p.setDocuments(writeJson(request.get("documents")));
    p.setNotes(str(request.get("notes")));
    p.setCreatedDate(now);
    p.setUpdatedDate(now);
    p.setIsSample(false);
    return ResponseEntity.ok(Map.of("permit", permits.save(p)));
  }

  private ResponseEntity<?> updatePermit(Map<String, Object> request) {
    String id = str(request.get("permit_id"));
    if (id.isEmpty()) {
      return ResponseEntity.badRequest().body(Map.of("error", "permit_id required"));
    }
    PermitOrAuthorityEntity p = permits.findById(id).orElse(null);
    if (p == null) {
      return ResponseEntity.status(404).body(Map.of("error", "Permit not found"));
    }

    for (String field : UPDATABLE) {
      if (!request.containsKey(field)) {
        continue;
      }
      Object value = request.get(field);
      switch (field) {
        case "status" -> p.setStatus(str(value));
        case "effective_date" -> p.setEffectiveDate(toDate(value));
        case "expiry_date" -> p.setExpiryDate(toDate(value));
        case "covered_challenges" -> p.setCoveredChallenges(writeJson(value));
        case "fee" -> p.setFee(toDouble(value));
        case "notes" -> p.setNotes(str(value));
        case "documents" -> p.setDocuments(writeJson(value));
        default -> { /* assigned_to has no column on this entity */ }
      }
    }
    p.setUpdatedDate(Instant.now());
    return ResponseEntity.ok(Map.of("permit", permits.save(p)));
  }

  private ResponseEntity<?> createAction(Map<String, Object> request) {
    String actionType = str(request.get("action_type"));
    if (actionType.isEmpty()) {
      return ResponseEntity.badRequest().body(Map.of("error", "action_type required"));
    }
    Instant now = Instant.now();
    PermitActionEntity a = new PermitActionEntity();
    a.setId(newId());
    a.setActionType(actionType);
    a.setInstrumentId(str(request.get("instrument_id")));
    a.setChallengeId(str(request.get("challenge_id")));
    a.setDueDate(toDate(request.get("due_date")));
    a.setStatus("pending");
    a.setAssignedTo(str(request.get("assigned_to")));
    a.setNotes(str(request.get("notes")));
    a.setCreatedDate(now);
    a.setUpdatedDate(now);
    a.setIsSample(false);
    return ResponseEntity.ok(Map.of("action", actions.save(a)));
  }

  private ResponseEntity<?> completeAction(Map<String, Object> request) {
    String id = str(request.get("action_id"));
    if (id.isEmpty()) {
      return ResponseEntity.badRequest().body(Map.of("error", "action_id required"));
    }
    PermitActionEntity a = actions.findById(id).orElse(null);
    if (a == null) {
      return ResponseEntity.status(404).body(Map.of("error", "Action not found"));
    }
    Instant now = Instant.now();
    a.setStatus("done");
    a.setEvidence(str(request.get("evidence")));
    a.setCompletedAt(now);
    a.setUpdatedDate(now);
    return ResponseEntity.ok(Map.of("action", actions.save(a)));
  }

  /**
   * Links a permit to a finding as evidence.
   *
   * <p>An invalid instrument is still recorded — the attempt is part of the
   * audit trail — but it does <b>not</b> satisfy the finding. Recording it
   * without that distinction is how an expired permit ends up looking like
   * compliance.
   */
  private ResponseEntity<?> linkToFinding(Map<String, Object> request, String email) {
    String findingId = str(request.get("finding_id"));
    String permitId = str(request.get("permit_id"));
    if (findingId.isEmpty() || permitId.isEmpty()) {
      return ResponseEntity.badRequest()
          .body(Map.of("error", "finding_id and permit_id required"));
    }

    PermitOrAuthorityEntity permit = permits.findById(permitId).orElse(null);
    if (permit == null) {
      return ResponseEntity.status(404).body(Map.of("error", "Permit not found"));
    }
    ComplianceAssessmentFindingEntity finding = findings.findById(findingId).orElse(null);
    if (finding == null) {
      return ResponseEntity.status(404).body(Map.of("error", "Finding not found"));
    }

    if (!service.isValid(permit, nz(finding.getChallengeId()))) {
      service.recordEvidence(findingId, "permit_record", permitId,
          "Permit " + nz(permit.getReferenceNumber()) + " linked but INVALID ("
              + nz(permit.getStatus()) + "). Finding NOT satisfied.",
          email);
      return ResponseEntity.ok(Map.of(
          "ok", true,
          "satisfied", false,
          "valid", false,
          "reason", "Permit is " + nz(permit.getStatus())
              + " or does not cover this challenge."));
    }

    service.recordEvidence(findingId, "permit_record", permitId,
        "Permit " + nz(permit.getReferenceNumber()) + " ("
            + nz(permit.getJurisdictionCode()) + ") linked as evidence.",
        email);

    // A permit only satisfies a finding whose rule says a permit record is
    // what satisfies it. Other obligations need their own kind of evidence.
    boolean satisfied = ruleVersions.findById(nz(finding.getRuleVersionId()))
        .map(v -> "permit_record".equals(v.getSatisfiedBy()))
        .orElse(false);
    if (satisfied) {
      finding.setStatus("satisfied");
      finding.setUpdatedDate(Instant.now());
      findings.save(finding);
    }

    return ResponseEntity.ok(Map.of("ok", true, "satisfied", satisfied, "valid", true));
  }

  private ResponseEntity<?> crossRecognition(Map<String, Object> request, String email) {
    String challengeId = str(request.get("challenge_id"));
    if (challengeId.isEmpty()) {
      return ResponseEntity.badRequest().body(Map.of("error", "challenge_id required"));
    }
    return ResponseEntity.ok(service.checkCrossRecognition(challengeId, email));
  }

  private String writeJson(Object value) {
    try {
      return value == null ? "[]" : mapper.writeValueAsString(value);
    } catch (Exception e) {
      return "[]";
    }
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

  /**
   * A date column value from a form field.
   *
   * <p>Returns null for anything unparseable rather than a guessed date: an
   * invented expiry on a permit is worse than none, because the validity check
   * treats an absent expiry as "does not expire".
   */
  private static java.time.LocalDate toDate(Object v) {
    String s = v == null ? "" : String.valueOf(v).trim();
    if (s.length() < 10) {
      return null;
    }
    try {
      return java.time.LocalDate.parse(s.substring(0, 10));
    } catch (Exception e) {
      return null;
    }
  }

  private static String newId() {
    return UUID.randomUUID().toString().replace("-", "").substring(0, 24);
  }
}
