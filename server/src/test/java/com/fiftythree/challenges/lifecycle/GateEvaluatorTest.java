package com.fiftythree.challenges.lifecycle;

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
import com.fiftythree.challenges.compliance.ComplianceAuditService;
import com.fiftythree.challenges.compliance.FindingQueryRepository;
import com.fiftythree.challenges.compliance.PermitActionQueryRepository;
import com.fiftythree.challenges.compliance.PromoterAppointmentQueryRepository;
import com.fiftythree.challenges.compliance.VotingConfigurationQueryRepository;
import com.fiftythree.challenges.entity.ChallengeEntity;
import com.fiftythree.challenges.entity.ChallengeRepository;
import com.fiftythree.challenges.entry.TermsDocumentQueryRepository;
import com.fiftythree.challenges.entity.ComplianceAssessmentFindingEntity;
import com.fiftythree.challenges.entity.GateCheckEntity;
import com.fiftythree.challenges.entity.TermsDocumentEntity;
import com.fiftythree.challenges.support.JsonColumn;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/**
 * The stage gates decide whether a competition may take entries or votes, so
 * the failure modes that matter are the quiet ones: a gate that passes when a
 * condition is unmet, a challenge that skips a stage, or a children's division
 * reaching the public because a field was omitted from the request.
 */
class GateEvaluatorTest {

  private static final String CID = "challenge-1";

  private GateCheckQueryRepository gateChecks;
  private FindingQueryRepository findings;
  private PromoterAppointmentQueryRepository promoters;
  private AssessmentQueryRepository assessments;
  private VotingConfigurationQueryRepository votingConfigs;
  private TermsDocumentQueryRepository terms;
  private PermitActionQueryRepository permitActions;
  private ChallengeRepository challenges;
  private ComplianceAuditService audit;

  private GateEvaluator evaluator;

  @BeforeEach
  void setUp() {
    gateChecks = mock(GateCheckQueryRepository.class);
    findings = mock(FindingQueryRepository.class);
    promoters = mock(PromoterAppointmentQueryRepository.class);
    assessments = mock(AssessmentQueryRepository.class);
    votingConfigs = mock(VotingConfigurationQueryRepository.class);
    terms = mock(TermsDocumentQueryRepository.class);
    permitActions = mock(PermitActionQueryRepository.class);
    challenges = mock(ChallengeRepository.class);
    audit = mock(ComplianceAuditService.class);

    // Nothing exists unless a test says it does, so every gate starts unmet.
    when(gateChecks.findLatest(anyString(), anyString())).thenReturn(List.of());
    when(findings.findBlockingForGate(anyString(), anyString())).thenReturn(List.of());
    when(findings.findAllBlocking(anyString())).thenReturn(List.of());
    when(promoters.findLatestFor(anyString())).thenReturn(List.of());
    when(assessments.findByChallenge(anyString())).thenReturn(List.of());
    when(votingConfigs.findLatestFor(anyString())).thenReturn(List.of());
    when(terms.findByChallengeAndStatuses(anyString(), any())).thenReturn(List.of());
    when(permitActions.findPendingRegulatorNotifications(anyString())).thenReturn(List.of());
    when(challenges.findById(anyString())).thenReturn(Optional.empty());

    evaluator = new GateEvaluator(gateChecks, findings, promoters, assessments, votingConfigs,
        terms, permitActions, challenges, audit, new JsonColumn(new ObjectMapper()));
  }

  // ------------------------------------------------------- sequencing

  @Test
  void aGateWithNoPredecessorPassedIsRefused() {
    // entry_open depends on approved_to_published. Without it, a challenge
    // could start taking entries having never been approved.
    GateEvaluator.Evaluation result = evaluator.evaluate(CID, "entry_open", null);

    assertFalse(result.canPass());
    assertTrue(checkNames(result).contains("approved_to_published_passed"),
        checkNames(result).toString());
  }

  @Test
  void aRelockedPredecessorDoesNotCountAsPassed() {
    // The gate record exists but its status is 'blocked' — a re-lock after a
    // finding reopened. Treating "a record exists" as "passed" would let a
    // re-locked challenge sail through.
    when(gateChecks.findLatest(CID, "approved_to_published"))
        .thenReturn(List.of(gateCheck("blocked")));

    GateEvaluator.Evaluation result = evaluator.evaluate(CID, "entry_open", null);

    assertFalse(failed(result, "approved_to_published_passed").isEmpty());
  }

  @Test
  void theFirstGateHasNoPredecessorToCheck() {
    GateEvaluator.Evaluation result = evaluator.evaluate(CID, "draft_to_review", null);
    assertTrue(result.canPass(), result.toMap().toString());
  }

  @Test
  void everyFailingConditionIsReportedNotJustTheFirst() {
    // The admin screen lists what is outstanding. Short-circuiting on the
    // first failure would turn fixing a challenge into one round trip per
    // problem.
    GateEvaluator.Evaluation result = evaluator.evaluate(CID, "review_to_approved", null);

    assertTrue(failed(result, "promoter_appointment").size() == 1, "promoter missing");
    assertTrue(failed(result, "assessment_run").size() == 1, "assessment missing");
    assertTrue(failed(result, "terms_document").size() == 1, "terms missing");
  }

  // ------------------------------------------------------- child safety

  @Test
  void aChildrensDivisionBlocksPublishingEvenWhenTheRequestOmitsDivisions() {
    // The divisions are absent from the request, so the gate must fall back to
    // the stored record. If it did not, omitting the field would be enough to
    // publish a children's competition.
    ChallengeEntity stored = new ChallengeEntity();
    stored.setId(CID);
    stored.setDivisions("[\"children\"]");
    when(challenges.findById(CID)).thenReturn(Optional.of(stored));
    when(gateChecks.findLatest(CID, "review_to_approved"))
        .thenReturn(List.of(gateCheck("passed")));

    GateEvaluator.Evaluation result = evaluator.evaluate(CID, "approved_to_published", null);

    assertFalse(result.canPass());
    assertFalse(failed(result, "no_kids_teens_divisions").isEmpty());
  }

  @Test
  void divisionMatchingIgnoresCaseAndSurroundingSpace() {
    GateEvaluator.ChallengeData data = data(null, null, null, List.of(" Teens "));
    when(gateChecks.findLatest(CID, "review_to_approved"))
        .thenReturn(List.of(gateCheck("passed")));

    GateEvaluator.Evaluation result = evaluator.evaluate(CID, "approved_to_published", data);

    assertFalse(failed(result, "no_kids_teens_divisions").isEmpty());
  }

  // ------------------------------------------------------- open findings

  @Test
  void anOpenBlockingFindingMappedToVotingBlocksVotingOpen() {
    when(findings.findBlockingForGate(CID, "open_voting"))
        .thenReturn(List.of(finding("f1", "open", "AU-LOTTERY-1")));

    GateEvaluator.Evaluation result = evaluator.evaluate(CID, "voting_open", null);

    assertFalse(result.canPass());
    assertEquals(List.of("f1"), result.blockingFindingIds());
  }

  @Test
  void aResolvedFindingDoesNotBlock() {
    when(findings.findBlockingForGate(CID, "open_voting"))
        .thenReturn(List.of(finding("f1", "resolved", "AU-LOTTERY-1")));

    GateEvaluator.Evaluation result = evaluator.evaluate(CID, "voting_open", null);

    assertTrue(result.blockingFindingIds().isEmpty());
    assertTrue(failed(result, "finding_f1").isEmpty());
  }

  // ------------------------------------------------------- passing

  @Test
  void passIsRefusedAndWritesNothingWhenConditionsAreUnmet() {
    GateEvaluator.PassResult result =
        evaluator.pass(CID, "entry_open", "u1", "a@b.com", null, false);

    assertFalse(result.passed());
    assertFalse(result.missing().isEmpty());
    // The important half: a refused gate must leave no GateCheck behind that a
    // later read could mistake for progress.
    verify(gateChecks, never()).save(any());
  }

  @Test
  void grandfatheringPassesAGateWhoseConditionsFail() {
    // The escape hatch for challenges that were already live. It must work,
    // and the record must say it was grandfathered.
    when(gateChecks.findLatest(CID, "entry_open")).thenReturn(List.of());

    GateEvaluator.PassResult result =
        evaluator.pass(CID, "entry_open", "u1", "a@b.com", null, true);

    assertTrue(result.passed());
    verify(gateChecks).save(any(GateCheckEntity.class));
  }

  @Test
  void passingAGateDoesNotRegressAChallengeAlreadyFurtherAlong() {
    // approved_to_published unlocks 'published'. A challenge already taking
    // votes must not be dragged back.
    ChallengeEntity stored = new ChallengeEntity();
    stored.setId(CID);
    stored.setLifecycleStatus("voting_open");
    when(challenges.findById(CID)).thenReturn(Optional.of(stored));

    evaluator.pass(CID, "approved_to_published", "u1", "a@b.com", null, true);

    assertEquals("voting_open", stored.getLifecycleStatus());
    verify(challenges, never()).save(any());
  }

  @Test
  void passingPublishMarksTheChallengeActive() {
    ChallengeEntity stored = new ChallengeEntity();
    stored.setId(CID);
    stored.setLifecycleStatus("approved");
    when(challenges.findById(CID)).thenReturn(Optional.of(stored));

    evaluator.pass(CID, "approved_to_published", "u1", "a@b.com", null, true);

    assertEquals("published", stored.getLifecycleStatus());
    assertEquals("active", stored.getStatus(), "a published challenge is publicly visible");
  }

  // ------------------------------------------------------- windows

  @Test
  void anEntryWindowThatHasAlreadyClosedFailsTheGate() {
    Instant past = Instant.now().minus(2, ChronoUnit.DAYS);
    GateEvaluator.ChallengeData data = data(past, past, null, List.of());
    when(gateChecks.findLatest(CID, "approved_to_published"))
        .thenReturn(List.of(gateCheck("passed")));
    when(terms.findByChallengeAndStatuses(CID, List.of("published")))
        .thenReturn(List.of(new TermsDocumentEntity()));

    GateEvaluator.Evaluation result = evaluator.evaluate(CID, "entry_open", data);

    assertTrue(failed(result, "entry_window_open").size() == 1);
    assertTrue(failed(result, "entry_window_started").isEmpty(), "the start date has passed");
  }

  @Test
  void votingCannotOpenWhileEntriesAreStillOpen() {
    Instant future = Instant.now().plus(5, ChronoUnit.DAYS);
    GateEvaluator.ChallengeData data =
        data(Instant.now().minus(1, ChronoUnit.DAYS), future, future, List.of());

    GateEvaluator.Evaluation result = evaluator.evaluate(CID, "voting_open", data);

    assertFalse(failed(result, "entries_closed").isEmpty());
  }

  // ------------------------------------------------------- phases

  @Test
  void phaseFollowsTheSchedule() {
    Instant past = Instant.now().minus(1, ChronoUnit.DAYS);
    Instant future = Instant.now().plus(1, ChronoUnit.DAYS);

    assertEquals("upcoming", evaluator.phase(data(future, future, future, List.of())));
    assertEquals("submit", evaluator.phase(data(past, future, future, List.of())));
    assertEquals("vote", evaluator.phase(data(past, past, future, List.of())));
    assertEquals("closed", evaluator.phase(data(past, past, past, List.of())));
    assertEquals("closed", evaluator.phase(null));
  }

  @Test
  void anUpcomingChallengeIsNeverGrandfathered() {
    // Grandfathering preserves a running competition. A challenge that has not
    // started yet has nothing to preserve and must be evaluated strictly.
    assertEquals(List.of(), evaluator.grandfatheredGatesForPhase("upcoming"));
    assertEquals(4, evaluator.grandfatheredGatesForPhase("submit").size());
    assertEquals(GateEvaluator.GATE_CODES, evaluator.grandfatheredGatesForPhase("vote"));
  }

  // ------------------------------------------------------- fixtures

  private static GateEvaluator.ChallengeData data(
      Instant startsAt, Instant submissionEndsAt, Instant votingEndsAt, List<String> divisions) {
    return new GateEvaluator.ChallengeData(
        CID, "Theme", "Title", "music", "Brief",
        startsAt, submissionEndsAt, votingEndsAt, divisions);
  }

  private static GateCheckEntity gateCheck(String status) {
    GateCheckEntity check = new GateCheckEntity();
    check.setId("gc-1");
    check.setChallengeId(CID);
    check.setStatus(status);
    return check;
  }

  private static ComplianceAssessmentFindingEntity finding(
      String id, String status, String ruleCode) {
    ComplianceAssessmentFindingEntity f = new ComplianceAssessmentFindingEntity();
    f.setId(id);
    f.setChallengeId(CID);
    f.setStatus(status);
    f.setRuleCode(ruleCode);
    f.setObligationType("permit_required");
    f.setBlocking(true);
    return f;
  }

  private static List<String> checkNames(GateEvaluator.Evaluation result) {
    return result.conditions().stream().map(GateEvaluator.Condition::check).toList();
  }

  private static List<GateEvaluator.Condition> failed(
      GateEvaluator.Evaluation result, String check) {
    return result.conditions().stream()
        .filter(c -> check.equals(c.check()) && !c.passed())
        .toList();
  }
}
