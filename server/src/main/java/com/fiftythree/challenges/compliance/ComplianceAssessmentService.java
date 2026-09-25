package com.fiftythree.challenges.compliance;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fiftythree.challenges.entity.ChallengeComplianceAssessmentEntity;
import com.fiftythree.challenges.entity.ComplianceAssessmentFindingEntity;
import com.fiftythree.challenges.entity.ComplianceTriggerEntity;
import com.fiftythree.challenges.entity.LegalPositionEntity;
import com.fiftythree.challenges.entity.RegulatoryRuleEntity;
import com.fiftythree.challenges.entity.RegulatoryRuleVersionEntity;
import com.fiftythree.challenges.lifecycle.AssessmentQueryRepository;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * The compliance assessment engine, ported from
 * {@code base44/shared/complianceAssessmentEngine.ts}.
 *
 * <p>Runs in four steps: assemble the facts, evaluate the triggers, classify
 * the challenge, and attach a finding for every signed rule version that
 * matches. The whole thing is <b>data-first</b> — triggers, rules, versions and
 * legal positions are editable records, never code — so adding a new obligation
 * is a data change, and nothing in this class names a specific regulation.
 *
 * <p>Two invariants carried over deliberately:
 *
 * <ul>
 *   <li><b>Only signed rule versions are evaluated.</b> An unsigned version is
 *       a draft. Evaluating drafts would attach obligations nobody has approved
 *       and block competitions on a colleague's half-finished thought.
 *   <li><b>Findings are never auto-closed here.</b> A re-assessment creates new
 *       findings and logs the ones that no longer match, but leaves them open.
 *       Closing a finding requires linked evidence or an explicit waiver with a
 *       reason — the record of why an obligation stopped applying matters more
 *       than a tidy list.
 * </ul>
 */
@Service
public class ComplianceAssessmentService {

  private static final Logger log = LoggerFactory.getLogger(ComplianceAssessmentService.class);

  /** Findings that still need work; a re-assessment must not duplicate them. */
  private static final List<String> UNRESOLVED = List.of("open", "in_progress");

  /** Triggers that mean an element of chance decides the outcome. */
  private static final Set<String> CHANCE_TRIGGERS = Set.of("chance_element", "instant_win");

  private static final Set<String> VOTING_TRIGGERS =
      Set.of("public_voting_determinative", "public_voting_component");

  private final FactsAssembler factsAssembler;
  private final ConditionEvaluator conditions;
  private final ComplianceTriggerQueryRepository triggers;
  private final LegalPositionQueryRepository legalPositions;
  private final RegulatoryRuleQueryRepository rules;
  private final RuleVersionQueryRepository versions;
  private final AssessmentQueryRepository assessments;
  private final AssessmentFindingQueryRepository findings;
  private final ComplianceAuditService audit;
  private final ObjectMapper mapper;

  public ComplianceAssessmentService(
      FactsAssembler factsAssembler,
      ConditionEvaluator conditions,
      ComplianceTriggerQueryRepository triggers,
      LegalPositionQueryRepository legalPositions,
      RegulatoryRuleQueryRepository rules,
      RuleVersionQueryRepository versions,
      AssessmentQueryRepository assessments,
      AssessmentFindingQueryRepository findings,
      ComplianceAuditService audit,
      ObjectMapper mapper) {
    this.factsAssembler = factsAssembler;
    this.conditions = conditions;
    this.triggers = triggers;
    this.legalPositions = legalPositions;
    this.rules = rules;
    this.versions = versions;
    this.assessments = assessments;
    this.findings = findings;
    this.audit = audit;
    this.mapper = mapper;
  }

  /** A rule version that applies, with the rule it belongs to. */
  private record Match(RegulatoryRuleVersionEntity version, RegulatoryRuleEntity rule) {}

  /** What one assessment run produced. */
  public record Result(
      ChallengeComplianceAssessmentEntity assessment,
      List<String> firedTriggers,
      String classification,
      List<String> ruleVersionsUsed,
      int findingsCreated,
      int findingsTotal) {}

  // ------------------------------------------------------------ sign-off

  /** A rule version is evaluated only once a named reviewer signed it on a date. */
  public boolean isSigned(RegulatoryRuleVersionEntity version) {
    JsonNode signoff = parse(version == null ? null : version.getLegalSignoff());
    return notBlank(signoff.path("reviewer").asText(""))
        && notBlank(signoff.path("date").asText(""))
        && notBlank(signoff.path("reference").asText(""));
  }

  // ---------------------------------------------------------- assessment

  /** Runs a full assessment and records it. */
  public Result run(
      String challengeId,
      Map<String, Object> factsOverride,
      String actorId,
      String actorEmail) {

    String cid = String.valueOf(challengeId);
    Map<String, Object> facts = factsAssembler.assemble(cid, factsOverride);

    List<String> fired = evaluateTriggers(facts);
    String classification = classify(fired);
    List<Match> matching = findMatchingRuleVersions(fired, facts);

    List<String> versionIds = matching.stream().map(m -> m.version().getId()).toList();

    Instant now = Instant.now();
    ChallengeComplianceAssessmentEntity assessment = new ChallengeComplianceAssessmentEntity();
    assessment.setId(newId());
    assessment.setChallengeId(cid);
    assessment.setFiredTriggers(write(fired));
    assessment.setClassification(classification);
    assessment.setAssessedAt(now);
    assessment.setRuleVersionsUsed(write(versionIds));
    assessment.setCreatedDate(now);
    assessment.setUpdatedDate(now);
    assessment.setIsSample(false);
    assessments.save(assessment);

    audit.assessmentEvent("assessment_run", cid, assessment.getId(), actorId, actorEmail,
        "Classification: " + classification + ". Triggers: "
            + (fired.isEmpty() ? "none" : String.join(", ", fired))
            + ". Rule versions matched: " + matching.size() + ".");

    List<ComplianceAssessmentFindingEntity> existing = findings.findByStatuses(cid, UNRESOLVED);
    Set<String> alreadyFound = new LinkedHashSet<>();
    for (ComplianceAssessmentFindingEntity f : existing) {
      alreadyFound.add(f.getRuleVersionId());
    }

    int created = 0;
    for (Match match : matching) {
      if (alreadyFound.contains(match.version().getId())) {
        continue;
      }
      created++;
      createFinding(cid, assessment.getId(), match, actorId, actorEmail);
    }

    // A finding whose rule version no longer matches is logged, not closed.
    // The facts may have changed back, or changed by mistake; an auditor needs
    // to see that it stopped applying, not find it silently gone.
    Set<String> matchedIds = new LinkedHashSet<>(versionIds);
    for (ComplianceAssessmentFindingEntity f : existing) {
      if (matchedIds.contains(f.getRuleVersionId())) {
        continue;
      }
      audit.findingEvent("finding_updated", cid, f.getId(), actorId, actorEmail,
          "Finding for rule " + nz(f.getRuleCode())
              + " re-evaluated — underlying facts changed, rule version no longer matches.");
    }

    return new Result(assessment, fired, classification, versionIds,
        created, existing.size() + created);
  }

  private void createFinding(
      String cid,
      String assessmentId,
      Match match,
      String actorId,
      String actorEmail) {

    RegulatoryRuleVersionEntity version = match.version();
    RegulatoryRuleEntity rule = match.rule();
    // Blocking unless explicitly set false: a rule version that forgot to say
    // should stop a launch, not wave one through.
    boolean blocking = !Boolean.FALSE.equals(version.getBlocking());

    Instant now = Instant.now();
    ComplianceAssessmentFindingEntity finding = new ComplianceAssessmentFindingEntity();
    finding.setId(newId());
    finding.setAssessmentId(assessmentId);
    finding.setChallengeId(cid);
    finding.setRuleVersionId(version.getId());
    finding.setRuleCode(firstNonBlank(rule.getCode(), version.getRuleCode()));
    finding.setObligationType(nz(version.getObligationType()));
    finding.setJurisdictionCode(nz(rule.getJurisdictionCode()));
    finding.setGate(blank(version.getGate()) ? "publish" : version.getGate());
    finding.setBlocking(blocking);
    finding.setStatus("open");
    finding.setCreatedDate(now);
    finding.setUpdatedDate(now);
    finding.setIsSample(false);
    findings.save(finding);

    audit.fullEvent("finding_created", cid, assessmentId, finding.getId(), actorId, actorEmail,
        "Finding created for rule " + nz(rule.getCode()) + " ("
            + nz(version.getObligationType()) + "). Blocking: " + blocking + ".");
  }

  /** The codes of every trigger whose detection conditions match the facts. */
  public List<String> evaluateTriggers(Map<String, Object> facts) {
    List<String> fired = new ArrayList<>();
    for (ComplianceTriggerEntity t : triggers.findInOrder()) {
      JsonNode definition = parse(t.getDetectionDefinition());
      if (conditions.matches(definition.path("conditions"), facts)) {
        fired.add(t.getCode());
      }
    }
    return fired;
  }

  /**
   * Classifies the challenge from what fired.
   *
   * <p>Chance beats everything, because a game of chance needs a permit
   * whatever else is true of it. Public voting is the genuinely unsettled case:
   * whether it makes a competition a game of chance is a legal judgement, so
   * the answer comes from the active {@code public_voting} legal position
   * rather than from this code. With no position recorded, the result is
   * {@code requires_legal_opinion} — not a guess.
   */
  public String classify(List<String> firedTriggers) {
    boolean hasChance = firedTriggers.stream().anyMatch(CHANCE_TRIGGERS::contains);
    boolean hasVoting = firedTriggers.stream().anyMatch(VOTING_TRIGGERS::contains);

    if (hasChance && hasVoting) {
      return "mixed";
    }
    if (hasChance) {
      return "game_of_chance";
    }
    if (!hasVoting) {
      return "game_of_skill";
    }

    List<LegalPositionEntity> positions = legalPositions.findActiveByTopic("public_voting");
    if (positions.isEmpty()) {
      return "requires_legal_opinion";
    }
    return switch (nz(positions.get(0).getPosition())) {
      case "treat_as_chance" -> "game_of_chance";
      case "treat_as_skill" -> "game_of_skill";
      // case_by_case, or anything unrecognised: a human decides.
      default -> "requires_legal_opinion";
    };
  }

  /**
   * The signed, current rule versions that apply to these facts.
   *
   * <p>A rule tied to a trigger only applies when that trigger fired; a rule
   * with no trigger is evaluated on its conditions alone.
   */
  private List<Match> findMatchingRuleVersions(
      List<String> firedTriggers, Map<String, Object> facts) {

    Map<String, RegulatoryRuleEntity> byCode = new LinkedHashMap<>();
    for (RegulatoryRuleEntity r : rules.findAllNewestFirst()) {
      byCode.putIfAbsent(r.getCode(), r);
    }

    List<Match> matching = new ArrayList<>();
    for (RegulatoryRuleVersionEntity v : versions.findCurrent()) {
      if (!isSigned(v)) {
        continue;
      }
      RegulatoryRuleEntity rule = byCode.get(v.getRuleCode());
      if (rule == null) {
        // A version whose rule was deleted. Skipping is right — there is no
        // jurisdiction or code to attribute a finding to.
        log.warn("Rule version {} references unknown rule code '{}'", v.getId(), v.getRuleCode());
        continue;
      }
      if (notBlank(rule.getTriggerCode()) && !firedTriggers.contains(rule.getTriggerCode())) {
        continue;
      }
      if (conditions.matches(parse(v.getConditionExpression()).path("conditions"), facts)) {
        matching.add(new Match(v, rule));
      }
    }
    return matching;
  }

  // ------------------------------------------------------------- helpers

  private JsonNode parse(String raw) {
    if (raw == null || raw.isBlank()) {
      return mapper.createObjectNode();
    }
    try {
      return mapper.readTree(raw);
    } catch (Exception e) {
      log.warn("Ignoring malformed compliance JSON column: {}", e.toString());
      return mapper.createObjectNode();
    }
  }

  private String write(Object value) {
    try {
      return mapper.writeValueAsString(value);
    } catch (Exception e) {
      throw new IllegalStateException("Could not serialise an assessment column", e);
    }
  }

  private static boolean blank(String value) {
    return value == null || value.isBlank();
  }

  private static boolean notBlank(String value) {
    return value != null && !value.trim().isEmpty();
  }

  private static String firstNonBlank(String a, String b) {
    return notBlank(a) ? a : nz(b);
  }

  private static String nz(String value) {
    return value == null ? "" : value;
  }

  private static String newId() {
    return UUID.randomUUID().toString().replace("-", "").substring(0, 24);
  }
}
