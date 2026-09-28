package com.fiftythree.challenges.compliance;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fiftythree.challenges.entity.ChallengeComplianceAssessmentEntity;
import com.fiftythree.challenges.entity.ChallengeEntity;
import com.fiftythree.challenges.entity.ChallengeRepository;
import com.fiftythree.challenges.entity.ComplianceAssessmentFindingEntity;
import com.fiftythree.challenges.entity.ComplianceAuditEventEntity;
import com.fiftythree.challenges.entity.ComplianceTriggerEntity;
import com.fiftythree.challenges.entity.JurisdictionEntity;
import com.fiftythree.challenges.entity.LegalPositionEntity;
import com.fiftythree.challenges.entity.ObligationEvidenceEntity;
import com.fiftythree.challenges.entity.RegulatoryRuleEntity;
import com.fiftythree.challenges.entity.RegulatoryRuleVersionEntity;
import com.fiftythree.challenges.lifecycle.AssessmentQueryRepository;
import com.fiftythree.challenges.security.CallerResolver;
import com.fiftythree.challenges.support.JsonColumn;
import com.fiftythree.challenges.user.UserRepository;
import com.fiftythree.challenges.support.ApiErrors;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Supplier;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/**
 * The Java replacement for {@code runComplianceAssessment}: the assessment
 * engine's API, plus the rule catalogue behind it.
 *
 * <p>Running an assessment does three things in sequence, and the order is not
 * arbitrary. The engine attaches findings; then any gate with an open blocking
 * finding is re-locked, so a newly discovered obligation stops a launch that
 * was previously cleared; then the permit follow-ups run — NT cross-recognition
 * to satisfy what an interstate permit already covers, and NSW notification
 * actions for authorities that need the regulator told before entries open.
 *
 * <p>Two rules about closing a finding, both enforced here:
 *
 * <ul>
 *   <li>{@code add_evidence} satisfies a finding <b>only</b> when the evidence
 *       type matches what the rule version says satisfies it. Attaching a
 *       document of the wrong kind records the document and leaves the
 *       obligation open.
 *   <li>{@code waive_finding} requires a reason. A waiver is someone taking
 *       responsibility for an unmet obligation, and an unexplained one is
 *       indistinguishable from a mistake.
 * </ul>
 */
@RestController
public class RunComplianceAssessmentController {

  private static final Logger log =
      LoggerFactory.getLogger(RunComplianceAssessmentController.class);

  private static final int LIST_LIMIT = 500;
  private static final int EVENT_LIMIT = 200;

  private final ComplianceAssessmentService engine;
  private final PermitService permits;
  private final ComplianceTriggerQueryRepository triggers;
  private final JurisdictionQueryRepository jurisdictions;
  private final LegalPositionQueryRepository legalPositions;
  private final RegulatoryRuleQueryRepository rules;
  private final RuleVersionQueryRepository versions;
  private final AssessmentQueryRepository assessments;
  private final AssessmentFindingQueryRepository findings;
  private final ObligationEvidenceQueryRepository evidence;
  private final AuditEventQueryRepository events;
  private final ChallengeRepository challenges;
  private final ComplianceAuditService audit;
  private final CallerResolver caller;
  private final UserRepository users;
  private final JsonColumn json;
  private final ObjectMapper mapper;

  public RunComplianceAssessmentController(
      ComplianceAssessmentService engine,
      PermitService permits,
      ComplianceTriggerQueryRepository triggers,
      JurisdictionQueryRepository jurisdictions,
      LegalPositionQueryRepository legalPositions,
      RegulatoryRuleQueryRepository rules,
      RuleVersionQueryRepository versions,
      AssessmentQueryRepository assessments,
      AssessmentFindingQueryRepository findings,
      ObligationEvidenceQueryRepository evidence,
      AuditEventQueryRepository events,
      ChallengeRepository challenges,
      ComplianceAuditService audit,
      CallerResolver caller,
      UserRepository users,
      JsonColumn json,
      ObjectMapper mapper) {
    this.engine = engine;
    this.permits = permits;
    this.triggers = triggers;
    this.jurisdictions = jurisdictions;
    this.legalPositions = legalPositions;
    this.rules = rules;
    this.versions = versions;
    this.assessments = assessments;
    this.findings = findings;
    this.evidence = evidence;
    this.events = events;
    this.challenges = challenges;
    this.audit = audit;
    this.caller = caller;
    this.users = users;
    this.json = json;
    this.mapper = mapper;
  }

  @PostMapping("/api/apps/{appId}/functions/runComplianceAssessment")
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
        // Reference data, readable by any signed-in caller.
        case "list_triggers" -> ResponseEntity.ok(Map.of("triggers",
            triggers.findInOrder().stream().map(this::triggerJson).toList()));
        case "list_jurisdictions" -> ResponseEntity.ok(Map.of("jurisdictions",
            jurisdictions.findAllNewestFirst().stream().map(this::jurisdictionJson).toList()));
        case "list_legal_positions" -> ResponseEntity.ok(Map.of("legal_positions",
            legalPositions.findAllNewestFirst().stream().map(this::positionJson).toList()));
        case "list_rules" -> listRules();

        case "assess" -> admin(isAdmin, () -> assess(request, actorId, email));
        case "get_assessment" -> admin(isAdmin, () -> getAssessment(request));
        case "list_findings" -> admin(isAdmin, () -> listFindings(request));
        case "waive_finding" -> admin(isAdmin,
            () -> waiveFinding(request, actorId, email), "Compliance officer only");
        case "add_evidence" -> admin(isAdmin, () -> addEvidence(request, actorId, email));
        case "create_rule" -> admin(isAdmin, () -> createRule(request));
        case "create_rule_version" -> admin(isAdmin,
            () -> createRuleVersion(request, actorId, email));
        case "sign_rule_version" -> admin(isAdmin,
            () -> signRuleVersion(request, actorId, email));
        case "list_audit_events" -> admin(isAdmin, () -> listAuditEvents(request));

        default -> ResponseEntity.status(400).body(Map.of("error", "Unknown action"));
      };
    } catch (Exception e) {
      log.error("runComplianceAssessment action '{}' failed", action, e);
      return ApiErrors.internal(e);
    }
  }

  private ResponseEntity<?> admin(boolean isAdmin, Supplier<ResponseEntity<?>> handler) {
    return admin(isAdmin, handler, "Admin only");
  }

  private ResponseEntity<?> admin(
      boolean isAdmin, Supplier<ResponseEntity<?>> handler, String message) {
    return isAdmin ? handler.get() : ResponseEntity.status(403).body(Map.of("error", message));
  }

  // ---------------------------------------------------------- assessment

  private ResponseEntity<?> assess(Map<String, Object> request, String actorId, String email) {
    String challengeId = str(request.get("challenge_id"));
    if (challengeId == null) {
      return ResponseEntity.status(400).body(Map.of("error", "challenge_id required"));
    }
    Map<String, Object> overrides = request.get("facts_override") instanceof Map<?, ?> supplied
        ? castMap(supplied)
        : Map.of();

    ComplianceAssessmentService.Result result =
        engine.run(challengeId, overrides, actorId, email);

    // A new blocking finding must re-lock whatever it now blocks, or the
    // assessment would report an obligation while the gate stayed open.
    List<String> relocked = permits.relockGatesWithOpenFindings(challengeId, email);

    // An interstate permit may already cover the NT obligation just raised.
    permits.checkCrossRecognition(challengeId, email);

    Instant entryOpen = challenges.findById(challengeId)
        .map(ChallengeEntity::getStartsAt)
        .orElse(null);
    permits.createNotificationActions(challengeId, entryOpen, email);

    Map<String, Object> payload = new LinkedHashMap<>();
    payload.put("assessment", assessmentJson(result.assessment()));
    payload.put("fired_triggers", result.firedTriggers());
    payload.put("classification", result.classification());
    payload.put("rule_versions_used", result.ruleVersionsUsed());
    payload.put("findings_created", result.findingsCreated());
    payload.put("findings_total", result.findingsTotal());
    payload.put("gates_relocked", relocked);
    return ResponseEntity.ok(Map.of("result", payload));
  }

  private ResponseEntity<?> getAssessment(Map<String, Object> request) {
    String challengeId = str(request.get("challenge_id"));
    if (challengeId == null) {
      return ResponseEntity.status(400).body(Map.of("error", "challenge_id required"));
    }
    Map<String, Object> latest = assessments.findByChallenge(challengeId).stream()
        .findFirst()
        .map(this::assessmentJson)
        .orElse(null);
    Map<String, Object> out = new LinkedHashMap<>();
    out.put("assessment", latest);
    return ResponseEntity.ok(out);
  }

  private ResponseEntity<?> listFindings(Map<String, Object> request) {
    String assessmentId = str(request.get("assessment_id"));
    String challengeId = str(request.get("challenge_id"));

    List<ComplianceAssessmentFindingEntity> rows;
    if (assessmentId != null) {
      rows = findings.findByAssessment(assessmentId);
    } else if (challengeId != null) {
      rows = findings.findByChallenge(challengeId);
    } else {
      rows = findings.findAllNewestFirst();
    }

    List<Map<String, Object>> out = new ArrayList<>();
    for (ComplianceAssessmentFindingEntity f : rows) {
      Map<String, Object> row = findingJson(f);
      // The evidence is what justifies a satisfied finding, so it travels with
      // it rather than needing a second round trip per row.
      row.put("evidence", evidence.findByFinding(f.getId()).stream()
          .map(this::evidenceJson).toList());
      out.add(row);
    }
    return ResponseEntity.ok(Map.of("findings", out));
  }

  // ------------------------------------------------------------ findings

  private ResponseEntity<?> waiveFinding(
      Map<String, Object> request, String actorId, String email) {

    String findingId = str(request.get("finding_id"));
    String reason = str(request.get("waiver_reason"));
    if (findingId == null) {
      return ResponseEntity.status(400).body(Map.of("error", "finding_id required"));
    }
    if (reason == null) {
      return ResponseEntity.status(400).body(Map.of("error", "waiver_reason is required"));
    }
    Optional<ComplianceAssessmentFindingEntity> found = findings.findById(findingId);
    if (found.isEmpty()) {
      return ResponseEntity.status(404).body(Map.of("error", "Finding not found"));
    }

    ComplianceAssessmentFindingEntity finding = found.get();
    finding.setStatus("waived");
    finding.setWaiverReason(reason);
    finding.setWaivedBy(email);
    finding.setWaivedAt(Instant.now());
    finding.setUpdatedDate(Instant.now());
    findings.save(finding);

    audit.findingEvent("finding_waived", finding.getChallengeId(), findingId, actorId, email,
        "Finding for rule " + nz(finding.getRuleCode()) + " waived. Reason: " + reason);

    return ResponseEntity.ok(Map.of("ok", true, "finding_id", findingId));
  }

  private ResponseEntity<?> addEvidence(
      Map<String, Object> request, String actorId, String email) {

    String findingId = str(request.get("finding_id"));
    String evidenceType = str(request.get("evidence_type"));
    if (findingId == null) {
      return ResponseEntity.status(400).body(Map.of("error", "finding_id required"));
    }
    if (evidenceType == null) {
      return ResponseEntity.status(400).body(Map.of("error", "evidence_type required"));
    }
    Optional<ComplianceAssessmentFindingEntity> found = findings.findById(findingId);
    if (found.isEmpty()) {
      return ResponseEntity.status(404).body(Map.of("error", "Finding not found"));
    }
    ComplianceAssessmentFindingEntity finding = found.get();

    Instant now = Instant.now();
    ObligationEvidenceEntity record = new ObligationEvidenceEntity();
    record.setId(newId());
    record.setFindingId(findingId);
    record.setEvidenceType(evidenceType);
    record.setFileRecord(orEmpty(str(request.get("file_record"))));
    record.setDescription(orEmpty(str(request.get("description"))));
    record.setRecordedBy(email);
    record.setRecordedAt(now);
    record.setCreatedDate(now);
    record.setUpdatedDate(now);
    record.setIsSample(false);
    evidence.save(record);

    // Only the evidence type the rule version names can satisfy the finding.
    // Anything else is filed against it and leaves the obligation open — which
    // is the difference between proving something and attaching a document.
    boolean satisfied = versions.findById(nz(finding.getRuleVersionId()))
        .map(v -> evidenceType.equals(v.getSatisfiedBy()))
        .orElse(false);
    if (satisfied) {
      finding.setStatus("satisfied");
      finding.setUpdatedDate(now);
      findings.save(finding);
    }

    audit.findingEvent("evidence_linked", finding.getChallengeId(), findingId, actorId, email,
        "Evidence (" + evidenceType + ") linked to finding for rule "
            + nz(finding.getRuleCode()) + "." + (satisfied ? " Finding satisfied." : ""));

    return ResponseEntity.ok(Map.of(
        "ok", true, "evidence_id", record.getId(), "satisfied", satisfied));
  }

  // --------------------------------------------------------------- rules

  private ResponseEntity<?> listRules() {
    Map<String, List<RegulatoryRuleVersionEntity>> byRule = new LinkedHashMap<>();
    for (RegulatoryRuleVersionEntity v : versions.findCurrent()) {
      byRule.computeIfAbsent(v.getRuleCode(), code -> new ArrayList<>()).add(v);
    }

    List<Map<String, Object>> out = new ArrayList<>();
    for (RegulatoryRuleEntity r : rules.findAllNewestFirst()) {
      List<RegulatoryRuleVersionEntity> ruleVersions =
          byRule.getOrDefault(r.getCode(), List.of());

      Map<String, Object> row = ruleJson(r);
      row.put("versions", ruleVersions.stream().map(this::versionJson).toList());
      // The current version is the first SIGNED one, not simply the newest:
      // an unsigned draft is not what the engine would evaluate, and showing
      // it as current would misrepresent what is in force.
      row.put("current_version", ruleVersions.stream()
          .filter(engine::isSigned)
          .findFirst()
          .map(this::versionJson)
          .orElse(null));
      out.add(row);
    }
    return ResponseEntity.ok(Map.of("rules", out));
  }

  private ResponseEntity<?> createRule(Map<String, Object> request) {
    String code = str(request.get("code"));
    String name = str(request.get("name"));
    String jurisdiction = str(request.get("jurisdiction_code"));
    if (code == null || name == null || jurisdiction == null) {
      return ResponseEntity.status(400).body(
          Map.of("error", "code, name, jurisdiction_code required"));
    }
    if (!rules.findByCode(code).isEmpty()) {
      return ResponseEntity.status(409).body(Map.of("error", "Rule code already exists"));
    }

    Instant now = Instant.now();
    RegulatoryRuleEntity rule = new RegulatoryRuleEntity();
    rule.setId(newId());
    rule.setCode(code);
    rule.setName(name);
    rule.setJurisdictionCode(jurisdiction);
    rule.setTriggerCode(orEmpty(str(request.get("trigger_code"))));
    rule.setDescription(orEmpty(str(request.get("description"))));
    rule.setCreatedDate(now);
    rule.setUpdatedDate(now);
    rule.setIsSample(false);
    rules.save(rule);

    return ResponseEntity.ok(Map.of("rule", ruleJson(rule)));
  }

  private ResponseEntity<?> createRuleVersion(
      Map<String, Object> request, String actorId, String email) {

    String ruleCode = str(request.get("rule_code"));
    String obligationType = str(request.get("obligation_type"));
    if (ruleCode == null || obligationType == null) {
      return ResponseEntity.status(400).body(
          Map.of("error", "rule_code, obligation_type required"));
    }
    if (rules.findByCode(ruleCode).isEmpty()) {
      return ResponseEntity.status(404).body(Map.of("error", "Rule not found"));
    }

    double next = versions.findByRuleCode(ruleCode).stream()
        .findFirst()
        .map(v -> v.getVersionNumber() == null ? 0 : v.getVersionNumber())
        .orElse(0d) + 1;

    Instant now = Instant.now();
    for (RegulatoryRuleVersionEntity previous : versions.findCurrentByRuleCode(ruleCode)) {
      previous.setIsCurrent(false);
      previous.setUpdatedDate(now);
      versions.save(previous);
    }

    RegulatoryRuleVersionEntity version = new RegulatoryRuleVersionEntity();
    version.setId(newId());
    version.setRuleCode(ruleCode);
    version.setVersionNumber(next);
    version.setConditionExpression(writeObject(request.get("condition_expression")));
    version.setObligationType(obligationType);
    version.setDetail(orEmpty(str(request.get("detail"))));
    version.setBlocking(!Boolean.FALSE.equals(request.get("blocking")));
    version.setSatisfiedBy(str(request.get("satisfied_by")) == null
        ? "evidence_item" : str(request.get("satisfied_by")));
    version.setGate(str(request.get("gate")) == null ? "publish" : str(request.get("gate")));
    version.setEffectiveFrom(now);
    // Created unsigned, and therefore inert: the engine skips it until someone
    // records who approved it.
    version.setLegalSignoff(writeObject(null));
    version.setIsCurrent(true);
    version.setCreatedDate(now);
    version.setUpdatedDate(now);
    version.setIsSample(false);
    versions.save(version);

    audit.event("rule_version_created", "", actorId, email,
        "Version " + plain(next) + " created for rule " + ruleCode + " (unsigned draft).");

    return ResponseEntity.ok(Map.of("version", versionJson(version)));
  }

  private ResponseEntity<?> signRuleVersion(
      Map<String, Object> request, String actorId, String email) {

    String versionId = str(request.get("version_id"));
    String reviewer = str(request.get("reviewer"));
    String date = str(request.get("date"));
    String reference = str(request.get("reference"));
    if (versionId == null) {
      return ResponseEntity.status(400).body(Map.of("error", "version_id required"));
    }
    if (reviewer == null || date == null || reference == null) {
      return ResponseEntity.status(400).body(
          Map.of("error", "reviewer, date, reference all required to sign"));
    }
    Optional<RegulatoryRuleVersionEntity> found = versions.findById(versionId);
    if (found.isEmpty()) {
      return ResponseEntity.status(404).body(Map.of("error", "Rule version not found"));
    }

    RegulatoryRuleVersionEntity version = found.get();
    version.setLegalSignoff(writeObject(Map.of(
        "reviewer", reviewer, "date", date, "reference", reference)));
    version.setUpdatedDate(Instant.now());
    versions.save(version);

    audit.event("rule_signed", "", actorId, email,
        "Rule version " + nz(version.getRuleCode()) + " v" + plain(version.getVersionNumber())
            + " signed by " + reviewer + " (ref: " + reference + ").");

    return ResponseEntity.ok(Map.of("ok", true, "version_id", versionId, "signed", true));
  }

  private ResponseEntity<?> listAuditEvents(Map<String, Object> request) {
    String challengeId = str(request.get("challenge_id"));
    PageRequest page = PageRequest.of(0, EVENT_LIMIT);
    List<ComplianceAuditEventEntity> rows = challengeId == null
        ? events.findAllNewestFirst(page)
        : events.findByChallenge(challengeId, page);
    return ResponseEntity.ok(Map.of("events", rows.stream().map(this::eventJson).toList()));
  }

  // -------------------------------------------------------------- shapes

  private Map<String, Object> triggerJson(ComplianceTriggerEntity t) {
    Map<String, Object> out = new LinkedHashMap<>();
    out.put("id", t.getId());
    out.put("code", t.getCode());
    out.put("name", t.getName());
    out.put("detection_source", t.getDetectionSource());
    out.put("detection_definition", node(t.getDetectionDefinition()));
    out.put("sort_order", t.getSortOrder());
    out.put("created_date", iso(t.getCreatedDate()));
    return out;
  }

  private Map<String, Object> jurisdictionJson(JurisdictionEntity j) {
    Map<String, Object> out = new LinkedHashMap<>();
    out.put("id", j.getId());
    out.put("code", j.getCode());
    out.put("name", j.getName());
    out.put("regulator_name", j.getRegulatorName());
    out.put("regulator_link", j.getRegulatorLink());
    return out;
  }

  private Map<String, Object> positionJson(LegalPositionEntity p) {
    Map<String, Object> out = new LinkedHashMap<>();
    out.put("id", p.getId());
    out.put("topic", p.getTopic());
    out.put("position", p.getPosition());
    out.put("source_document", p.getSourceDocument());
    out.put("effective_from", iso(p.getEffectiveFrom()));
    out.put("review_by", p.getReviewBy());
    out.put("is_active", p.getIsActive());
    return out;
  }

  private Map<String, Object> ruleJson(RegulatoryRuleEntity r) {
    Map<String, Object> out = new LinkedHashMap<>();
    out.put("id", r.getId());
    out.put("code", r.getCode());
    out.put("name", r.getName());
    out.put("jurisdiction_code", r.getJurisdictionCode());
    out.put("trigger_code", r.getTriggerCode());
    out.put("description", r.getDescription());
    out.put("created_date", iso(r.getCreatedDate()));
    return out;
  }

  private Map<String, Object> versionJson(RegulatoryRuleVersionEntity v) {
    Map<String, Object> out = new LinkedHashMap<>();
    out.put("id", v.getId());
    out.put("rule_code", v.getRuleCode());
    out.put("version_number", v.getVersionNumber());
    out.put("condition_expression", node(v.getConditionExpression()));
    out.put("obligation_type", v.getObligationType());
    out.put("detail", v.getDetail());
    out.put("blocking", v.getBlocking());
    out.put("satisfied_by", v.getSatisfiedBy());
    out.put("gate", v.getGate());
    out.put("effective_from", iso(v.getEffectiveFrom()));
    out.put("legal_signoff", node(v.getLegalSignoff()));
    out.put("is_current", v.getIsCurrent());
    out.put("created_date", iso(v.getCreatedDate()));
    return out;
  }

  private Map<String, Object> assessmentJson(ChallengeComplianceAssessmentEntity a) {
    if (a == null) {
      return null;
    }
    Map<String, Object> out = new LinkedHashMap<>();
    out.put("id", a.getId());
    out.put("challenge_id", a.getChallengeId());
    out.put("fired_triggers", json.stringList(a.getFiredTriggers()));
    out.put("classification", a.getClassification());
    out.put("assessed_at", iso(a.getAssessedAt()));
    out.put("rule_versions_used", json.stringList(a.getRuleVersionsUsed()));
    out.put("created_date", iso(a.getCreatedDate()));
    return out;
  }

  private Map<String, Object> findingJson(ComplianceAssessmentFindingEntity f) {
    Map<String, Object> out = new LinkedHashMap<>();
    out.put("id", f.getId());
    out.put("assessment_id", f.getAssessmentId());
    out.put("challenge_id", f.getChallengeId());
    out.put("rule_version_id", f.getRuleVersionId());
    out.put("rule_code", f.getRuleCode());
    out.put("obligation_type", f.getObligationType());
    out.put("jurisdiction_code", f.getJurisdictionCode());
    out.put("gate", f.getGate());
    out.put("blocking", f.getBlocking());
    out.put("status", f.getStatus());
    out.put("waiver_reason", f.getWaiverReason());
    out.put("waived_by", f.getWaivedBy());
    out.put("waived_at", iso(f.getWaivedAt()));
    out.put("created_date", iso(f.getCreatedDate()));
    return out;
  }

  private Map<String, Object> evidenceJson(ObligationEvidenceEntity e) {
    Map<String, Object> out = new LinkedHashMap<>();
    out.put("id", e.getId());
    out.put("finding_id", e.getFindingId());
    out.put("evidence_type", e.getEvidenceType());
    out.put("file_record", e.getFileRecord());
    out.put("description", e.getDescription());
    out.put("recorded_by", e.getRecordedBy());
    out.put("recorded_at", iso(e.getRecordedAt()));
    return out;
  }

  private Map<String, Object> eventJson(ComplianceAuditEventEntity e) {
    Map<String, Object> out = new LinkedHashMap<>();
    out.put("id", e.getId());
    out.put("event_type", e.getEventType());
    out.put("challenge_id", e.getChallengeId());
    out.put("assessment_id", e.getAssessmentId());
    out.put("finding_id", e.getFindingId());
    out.put("actor_id", e.getActorId());
    out.put("actor_email", e.getActorEmail());
    out.put("detail", e.getDetail());
    out.put("created_date", iso(e.getCreatedDate()));
    return out;
  }

  // ------------------------------------------------------------- helpers

  private JsonNode node(String raw) {
    if (raw == null || raw.isBlank()) {
      return mapper.createObjectNode();
    }
    try {
      return mapper.readTree(raw);
    } catch (Exception e) {
      return mapper.createObjectNode();
    }
  }

  private String writeObject(Object value) {
    try {
      return mapper.writeValueAsString(value instanceof Map<?, ?> map ? map : Map.of());
    } catch (Exception e) {
      throw new IllegalStateException("Could not serialise a rule column", e);
    }
  }

  @SuppressWarnings("unchecked")
  private static Map<String, Object> castMap(Map<?, ?> supplied) {
    return (Map<String, Object>) supplied;
  }

  /** Renders a version number as 3 rather than 3.0, which is how people say it. */
  private static String plain(Double value) {
    if (value == null) {
      return "";
    }
    return value == Math.rint(value) ? String.valueOf(value.longValue()) : String.valueOf(value);
  }

  private static String iso(Instant value) {
    return value == null ? null : value.toString();
  }

  private static String orEmpty(String value) {
    return value == null ? "" : value;
  }

  private static String nz(String value) {
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
