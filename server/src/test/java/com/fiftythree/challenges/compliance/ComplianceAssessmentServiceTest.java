package com.fiftythree.challenges.compliance;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fiftythree.challenges.entity.ComplianceAssessmentFindingEntity;
import com.fiftythree.challenges.entity.ComplianceTriggerEntity;
import com.fiftythree.challenges.entity.LegalPositionEntity;
import com.fiftythree.challenges.entity.RegulatoryRuleEntity;
import com.fiftythree.challenges.entity.RegulatoryRuleVersionEntity;
import com.fiftythree.challenges.lifecycle.AssessmentQueryRepository;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

/**
 * The assessment engine decides whether a competition is a game of chance,
 * which decides whether it needs a permit to run lawfully. The tests here
 * cover the three ways that judgement can go wrong quietly: an unsigned rule
 * being treated as in force, voting being classified without the legal
 * position that governs it, and a re-assessment either duplicating findings or
 * closing ones nobody resolved.
 */
class ComplianceAssessmentServiceTest {

  private static final String CID = "challenge-1";
  private static final String SIGNOFF =
      "{\"reviewer\":\"A Lawyer\",\"date\":\"2026-01-01\",\"reference\":\"OP-1\"}";

  private final ObjectMapper mapper = new ObjectMapper();

  private FactsAssembler factsAssembler;
  private ComplianceTriggerQueryRepository triggers;
  private LegalPositionQueryRepository legalPositions;
  private RegulatoryRuleQueryRepository rules;
  private RuleVersionQueryRepository versions;
  private AssessmentQueryRepository assessments;
  private AssessmentFindingQueryRepository findings;
  private ComplianceAuditService audit;

  private ComplianceAssessmentService service;

  @BeforeEach
  void setUp() {
    factsAssembler = mock(FactsAssembler.class);
    triggers = mock(ComplianceTriggerQueryRepository.class);
    legalPositions = mock(LegalPositionQueryRepository.class);
    rules = mock(RegulatoryRuleQueryRepository.class);
    versions = mock(RuleVersionQueryRepository.class);
    assessments = mock(AssessmentQueryRepository.class);
    findings = mock(AssessmentFindingQueryRepository.class);
    audit = mock(ComplianceAuditService.class);

    when(factsAssembler.assemble(anyString(), any())).thenReturn(Map.of("challenge_id", CID));
    when(triggers.findInOrder()).thenReturn(List.of());
    when(legalPositions.findActiveByTopic(anyString())).thenReturn(List.of());
    when(rules.findAllNewestFirst()).thenReturn(List.of());
    when(versions.findCurrent()).thenReturn(List.of());
    when(findings.findByStatuses(anyString(), any())).thenReturn(List.of());

    service = new ComplianceAssessmentService(factsAssembler, new ConditionEvaluator(), triggers,
        legalPositions, rules, versions, assessments, findings, audit, mapper);
  }

  // ------------------------------------------------------------ sign-off

  @Test
  void aRuleVersionIsSignedOnlyWithReviewerDateAndReference() {
    assertTrue(service.isSigned(version("v1", "R1", SIGNOFF)));
    assertFalse(service.isSigned(version("v1", "R1", "{}")));
    assertFalse(service.isSigned(version("v1", "R1", null)));
    assertFalse(service.isSigned(version("v1", "R1",
        "{\"reviewer\":\"A Lawyer\",\"date\":\"\",\"reference\":\"OP-1\"}")));
  }

  @Test
  void anUnsignedRuleVersionRaisesNoFinding() {
    // A draft obligation must not block a competition. This is the single most
    // consequential filter in the engine.
    when(rules.findAllNewestFirst()).thenReturn(List.of(rule("R1", null)));
    when(versions.findCurrent()).thenReturn(List.of(version("v1", "R1", "{}")));

    ComplianceAssessmentService.Result result = service.run(CID, Map.of(), "u1", "a@b.com");

    assertEquals(0, result.findingsCreated());
    assertTrue(result.ruleVersionsUsed().isEmpty());
    verify(findings, never()).save(any());
  }

  @Test
  void aSignedRuleVersionRaisesAFinding() {
    when(rules.findAllNewestFirst()).thenReturn(List.of(rule("R1", null)));
    when(versions.findCurrent()).thenReturn(List.of(version("v1", "R1", SIGNOFF)));

    ComplianceAssessmentService.Result result = service.run(CID, Map.of(), "u1", "a@b.com");

    assertEquals(1, result.findingsCreated());
    ArgumentCaptor<ComplianceAssessmentFindingEntity> saved =
        ArgumentCaptor.forClass(ComplianceAssessmentFindingEntity.class);
    verify(findings).save(saved.capture());
    assertEquals("open", saved.getValue().getStatus());
    assertEquals("R1", saved.getValue().getRuleCode());
    assertTrue(saved.getValue().getBlocking(), "blocking unless the version says otherwise");
  }

  @Test
  void aRuleWhoseTriggerDidNotFireIsSkipped() {
    when(rules.findAllNewestFirst()).thenReturn(List.of(rule("R1", "chance_element")));
    when(versions.findCurrent()).thenReturn(List.of(version("v1", "R1", SIGNOFF)));

    ComplianceAssessmentService.Result result = service.run(CID, Map.of(), "u1", "a@b.com");

    assertEquals(0, result.findingsCreated());
  }

  @Test
  void aVersionWhoseRuleIsMissingIsSkippedRatherThanThrowing() {
    // The rule was deleted but the version was not. There is no jurisdiction
    // to attribute a finding to, and a crash here would take out the whole
    // assessment screen.
    when(rules.findAllNewestFirst()).thenReturn(List.of());
    when(versions.findCurrent()).thenReturn(List.of(version("v1", "GONE", SIGNOFF)));

    assertEquals(0, service.run(CID, Map.of(), "u1", "a@b.com").findingsCreated());
  }

  // ---------------------------------------------------------- re-running

  @Test
  void reRunningDoesNotDuplicateAnOpenFinding() {
    when(rules.findAllNewestFirst()).thenReturn(List.of(rule("R1", null)));
    when(versions.findCurrent()).thenReturn(List.of(version("v1", "R1", SIGNOFF)));
    when(findings.findByStatuses(anyString(), any())).thenReturn(List.of(finding("f1", "v1")));

    ComplianceAssessmentService.Result result = service.run(CID, Map.of(), "u1", "a@b.com");

    assertEquals(0, result.findingsCreated());
    assertEquals(1, result.findingsTotal());
    verify(findings, never()).save(any());
  }

  @Test
  void aFindingThatNoLongerMatchesIsLoggedNotClosed() {
    // Silently closing it would erase the record of an obligation that once
    // applied. An auditor needs to see that it stopped applying, and when.
    ComplianceAssessmentFindingEntity stale = finding("f1", "v-gone");
    when(findings.findByStatuses(anyString(), any())).thenReturn(List.of(stale));

    service.run(CID, Map.of(), "u1", "a@b.com");

    assertEquals("open", stale.getStatus());
    verify(audit).findingEvent(
        org.mockito.ArgumentMatchers.eq("finding_updated"),
        anyString(), org.mockito.ArgumentMatchers.eq("f1"),
        anyString(), anyString(), anyString());
  }

  // ------------------------------------------------------ classification

  @Test
  void chanceBeatsEverything() {
    assertEquals("game_of_chance", service.classify(List.of("chance_element")));
    assertEquals("game_of_chance", service.classify(List.of("instant_win")));
    assertEquals("mixed",
        service.classify(List.of("chance_element", "public_voting_determinative")));
  }

  @Test
  void noTriggersMeansAGameOfSkill() {
    assertEquals("game_of_skill", service.classify(List.of()));
    assertEquals("game_of_skill", service.classify(List.of("something_unrelated")));
  }

  @Test
  void votingWithNoLegalPositionRequiresALegalOpinion() {
    // The unsettled case. Guessing "skill" here would ship a competition that
    // may legally need a permit; guessing "chance" would demand permits nobody
    // needs. Neither is this code's call to make.
    assertEquals("requires_legal_opinion",
        service.classify(List.of("public_voting_determinative")));
  }

  @Test
  void votingFollowsTheActiveLegalPosition() {
    when(legalPositions.findActiveByTopic("public_voting"))
        .thenReturn(List.of(position("treat_as_chance")));
    assertEquals("game_of_chance", service.classify(List.of("public_voting_component")));

    when(legalPositions.findActiveByTopic("public_voting"))
        .thenReturn(List.of(position("treat_as_skill")));
    assertEquals("game_of_skill", service.classify(List.of("public_voting_component")));

    when(legalPositions.findActiveByTopic("public_voting"))
        .thenReturn(List.of(position("case_by_case")));
    assertEquals("requires_legal_opinion", service.classify(List.of("public_voting_component")));
  }

  // ----------------------------------------------------------- triggers

  @Test
  void aTriggerFiresWhenItsConditionsMatchTheFacts() {
    when(triggers.findInOrder()).thenReturn(List.of(
        trigger("chance_element", "{\"conditions\":[{\"field\":\"mechanic_slug\","
            + "\"operator\":\"eq\",\"value\":\"random_draw\"}]}"),
        trigger("public_voting_determinative", "{\"conditions\":[{\"field\":\"voting_purpose\","
            + "\"operator\":\"eq\",\"value\":\"determines_winner\"}]}")));

    assertEquals(List.of("chance_element"),
        service.evaluateTriggers(Map.of("mechanic_slug", "random_draw")));
    assertEquals(List.of("public_voting_determinative"),
        service.evaluateTriggers(Map.of("voting_purpose", "determines_winner")));
    assertEquals(List.of(), service.evaluateTriggers(Map.of()));
  }

  @Test
  void aTriggerWithNoConditionsAlwaysFires() {
    when(triggers.findInOrder()).thenReturn(List.of(trigger("always", "{}")));
    assertEquals(List.of("always"), service.evaluateTriggers(Map.of()));
  }

  // ----------------------------------------------------- business days

  @Test
  void notificationDeadlinesCountBackOverWeekends() {
    // Ten business days before Monday 2 March 2026 is Monday 16 February:
    // fourteen calendar days, four of them weekend.
    assertEquals(LocalDate.of(2026, 2, 16),
        PermitService.businessDaysBefore(LocalDate.of(2026, 3, 2), 10));
    // One business day before a Monday is the preceding Friday.
    assertEquals(LocalDate.of(2026, 2, 27),
        PermitService.businessDaysBefore(LocalDate.of(2026, 3, 2), 1));
  }

  // ------------------------------------------------------------ fixtures

  private static RegulatoryRuleEntity rule(String code, String triggerCode) {
    RegulatoryRuleEntity r = new RegulatoryRuleEntity();
    r.setId("rule-" + code);
    r.setCode(code);
    r.setName("Rule " + code);
    r.setJurisdictionCode("NSW");
    r.setTriggerCode(triggerCode);
    return r;
  }

  private static RegulatoryRuleVersionEntity version(String id, String ruleCode, String signoff) {
    RegulatoryRuleVersionEntity v = new RegulatoryRuleVersionEntity();
    v.setId(id);
    v.setRuleCode(ruleCode);
    v.setVersionNumber(1d);
    v.setObligationType("permit_required");
    v.setLegalSignoff(signoff);
    v.setIsCurrent(true);
    return v;
  }

  private static ComplianceAssessmentFindingEntity finding(String id, String versionId) {
    ComplianceAssessmentFindingEntity f = new ComplianceAssessmentFindingEntity();
    f.setId(id);
    f.setChallengeId(CID);
    f.setRuleVersionId(versionId);
    f.setRuleCode("R1");
    f.setStatus("open");
    return f;
  }

  private static ComplianceTriggerEntity trigger(String code, String definition) {
    ComplianceTriggerEntity t = new ComplianceTriggerEntity();
    t.setId("trigger-" + code);
    t.setCode(code);
    t.setDetectionDefinition(definition);
    return t;
  }

  private static LegalPositionEntity position(String position) {
    LegalPositionEntity p = new LegalPositionEntity();
    p.setId("lp-1");
    p.setTopic("public_voting");
    p.setPosition(position);
    p.setIsActive(true);
    return p;
  }

}
