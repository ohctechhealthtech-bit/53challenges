package com.fiftythree.challenges.lifecycle;

import com.fiftythree.challenges.compliance.ComplianceAuditService;
import com.fiftythree.challenges.compliance.FindingQueryRepository;
import com.fiftythree.challenges.compliance.PermitActionQueryRepository;
import com.fiftythree.challenges.compliance.PromoterAppointmentQueryRepository;
import com.fiftythree.challenges.compliance.VotingConfigurationQueryRepository;
import com.fiftythree.challenges.entity.ChallengeEntity;
import com.fiftythree.challenges.entity.ChallengeRepository;
import com.fiftythree.challenges.entity.ComplianceAssessmentFindingEntity;
import com.fiftythree.challenges.entity.GateCheckEntity;
import com.fiftythree.challenges.entity.VotingConfigurationEntity;
import com.fiftythree.challenges.entry.TermsDocumentQueryRepository;
import com.fiftythree.challenges.support.JsonColumn;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * The stage-gate machinery, ported from {@code base44/shared/lifecycleGateHelper.ts}.
 *
 * <p>A challenge moves through five gates in order, and each one is passed only
 * when every named condition holds:
 *
 * <ol>
 *   <li>{@code draft_to_review} — the draft is complete enough to review
 *   <li>{@code review_to_approved} — promoter appointed, an assessment run,
 *       zero unresolved blocking findings, a legal opinion where voting decides
 *       the winner, and draft terms on file
 *   <li>{@code approved_to_published} — the previous gate passed, and no
 *       children/teens divisions
 *   <li>{@code entry_open} — published terms, no outstanding regulator
 *       notification, and an entry window that is open
 *   <li>{@code voting_open} — a voting configuration, entries closed, and a
 *       voting window that is open
 * </ol>
 *
 * <p>Two properties are worth stating because they are easy to lose in a
 * rewrite. Gates are <b>sequential</b>: each checks that its predecessor
 * passed, so nothing reaches voting without having been approved. And the
 * conditions are <b>all</b> evaluated even once one has failed — the admin
 * screen lists every outstanding item, and short-circuiting would make fixing a
 * challenge a game of whack-a-mole.
 *
 * <p>{@link LifecycleGateService} is the read-only enforcement side of the same
 * system: it asks whether a gate is passed. This class is what decides that.
 */
@Service
public class GateEvaluator {

  private static final Logger log = LoggerFactory.getLogger(GateEvaluator.class);

  /** The stage gates, earliest to latest. Order is the sequential dependency. */
  public static final List<String> GATE_CODES = List.of(
      "draft_to_review",
      "review_to_approved",
      "approved_to_published",
      "entry_open",
      "voting_open");

  /** The lifecycle status each gate unlocks on a native challenge. */
  private static final Map<String, String> GATE_TO_LIFECYCLE_STATUS = Map.of(
      "draft_to_review", "in_review",
      "review_to_approved", "approved",
      "approved_to_published", "published",
      "entry_open", "entry_open",
      "voting_open", "voting_open");

  private static final List<String> LIFECYCLE_ORDER = List.of(
      "draft", "in_review", "approved", "published", "entry_open", "voting_open", "closed");

  private static final Set<String> OPEN_FINDING_STATUSES = Set.of("open", "in_progress");

  /** Voting that decides the outcome needs a lawyer to have looked at it. */
  private static final Set<String> VOTING_PURPOSES_REQUIRING_LEGAL =
      Set.of("determines_winner", "weighted_component");

  /** Divisions that cannot go live until guardian consent is running. */
  private static final Set<String> KIDS_DIVISIONS = Set.of("children", "teens");

  private static final List<String> DRAFT_OR_LATER_TERMS =
      List.of("draft", "reviewed", "published");

  private final GateCheckQueryRepository gateChecks;
  private final FindingQueryRepository findings;
  private final PromoterAppointmentQueryRepository promoters;
  private final AssessmentQueryRepository assessments;
  private final VotingConfigurationQueryRepository votingConfigs;
  private final TermsDocumentQueryRepository terms;
  private final PermitActionQueryRepository permitActions;
  private final ChallengeRepository challenges;
  private final ComplianceAuditService audit;
  private final JsonColumn json;

  public GateEvaluator(
      GateCheckQueryRepository gateChecks,
      FindingQueryRepository findings,
      PromoterAppointmentQueryRepository promoters,
      AssessmentQueryRepository assessments,
      VotingConfigurationQueryRepository votingConfigs,
      TermsDocumentQueryRepository terms,
      PermitActionQueryRepository permitActions,
      ChallengeRepository challenges,
      ComplianceAuditService audit,
      JsonColumn json) {
    this.gateChecks = gateChecks;
    this.findings = findings;
    this.promoters = promoters;
    this.assessments = assessments;
    this.votingConfigs = votingConfigs;
    this.terms = terms;
    this.permitActions = permitActions;
    this.challenges = challenges;
    this.audit = audit;
    this.json = json;
  }

  /** One named requirement and whether it currently holds. */
  public record Condition(String check, String description, boolean passed) {

    Map<String, Object> toMap() {
      return Map.of("check", check, "description", description, "passed", passed);
    }

    Map<String, Object> toMissingMap() {
      return Map.of("check", check, "description", description);
    }
  }

  /** The outcome of evaluating one gate: what was checked, and what is missing. */
  public record Evaluation(
      boolean canPass, List<Condition> conditions, List<String> blockingFindingIds) {

    public Map<String, Object> toMap() {
      Map<String, Object> out = new LinkedHashMap<>();
      out.put("can_pass", canPass);
      out.put("conditions", conditions.stream().map(Condition::toMap).toList());
      out.put("missing", conditions.stream()
          .filter(c -> !c.passed())
          .map(Condition::toMissingMap)
          .toList());
      out.put("blocking_findings", blockingFindingIds);
      return out;
    }

    public List<Map<String, Object>> missing() {
      return conditions.stream()
          .filter(c -> !c.passed())
          .map(Condition::toMissingMap)
          .toList();
    }
  }

  /**
   * The challenge data a gate needs. Supplied by the caller for upstream
   * challenges, which have no row in this database.
   *
   * <p>A null field means "not supplied", and the conditions that depend on it
   * are skipped rather than failed — the original did the same, because an
   * upstream challenge the caller knows nothing about must not be reported as
   * broken.
   */
  public record ChallengeData(
      String id,
      String theme,
      String title,
      String category,
      String brief,
      Instant startsAt,
      Instant submissionEndsAt,
      Instant votingEndsAt,
      List<String> divisions) {}

  // ------------------------------------------------------------- evaluation

  /** Evaluates one gate. {@code data} may be null for a challenge held upstream. */
  public Evaluation evaluate(String challengeId, String gateCode, ChallengeData data) {
    String cid = String.valueOf(challengeId);
    List<Condition> conditions = new ArrayList<>();
    List<String> blocking = new ArrayList<>();

    // Findings mapped to this gate's obligation scope. review_to_approved
    // looks at every blocking finding; the later gates look only at the ones
    // that block the specific thing they unlock.
    String findingGate = switch (gateCode) {
      case "entry_open" -> "open_entry";
      case "voting_open" -> "open_voting";
      default -> null;
    };
    if (findingGate != null) {
      for (ComplianceAssessmentFindingEntity f
          : findings.findBlockingForGate(cid, findingGate)) {
        if (OPEN_FINDING_STATUSES.contains(f.getStatus())) {
          blocking.add(f.getId());
          conditions.add(new Condition("finding_" + f.getId(),
              "Blocking finding for " + f.getRuleCode() + " (" + f.getObligationType()
                  + ") is " + f.getStatus() + ".", false));
        }
      }
    }

    switch (gateCode) {
      case "draft_to_review" -> draftToReview(conditions, data);
      case "review_to_approved" -> reviewToApproved(conditions, blocking, cid);
      case "approved_to_published" -> approvedToPublished(conditions, cid, data);
      case "entry_open" -> entryOpen(conditions, cid, data);
      case "voting_open" -> votingOpen(conditions, cid, data);
      default -> conditions.add(
          new Condition("unknown_gate", "Unknown gate '" + gateCode + "'.", false));
    }

    boolean canPass = conditions.stream().allMatch(Condition::passed);
    return new Evaluation(canPass, List.copyOf(conditions), List.copyOf(blocking));
  }

  private void draftToReview(List<Condition> conditions, ChallengeData data) {
    // With no data supplied there is nothing to check, so these pass. An
    // upstream challenge is not a broken draft.
    boolean hasTheme = data == null || notBlank(data.theme()) || notBlank(data.title());
    boolean hasBrief = data == null || notBlank(data.brief());
    boolean hasCategory = data == null || notBlank(data.category());
    conditions.add(new Condition("draft_theme", "Challenge theme/title is set.", hasTheme));
    conditions.add(new Condition("draft_brief", "Challenge brief is set.", hasBrief));
    conditions.add(new Condition("draft_category", "Challenge category is set.", hasCategory));
  }

  private void reviewToApproved(List<Condition> conditions, List<String> blocking, String cid) {
    conditions.add(new Condition("draft_to_review_passed",
        "draft_to_review gate has passed.", previousGatePassed(cid, "review_to_approved")));

    conditions.add(new Condition("promoter_appointment",
        "PromoterAppointment record required.", !promoters.findLatestFor(cid).isEmpty()));

    conditions.add(new Condition("assessment_run",
        "Compliance assessment has been run.", !assessments.findByChallenge(cid).isEmpty()));

    List<ComplianceAssessmentFindingEntity> unresolved = findings.findAllBlocking(cid).stream()
        .filter(f -> OPEN_FINDING_STATUSES.contains(f.getStatus()))
        .toList();
    conditions.add(new Condition("zero_blocking_findings",
        "Zero unresolved blocking compliance findings.", unresolved.isEmpty()));
    for (ComplianceAssessmentFindingEntity f : unresolved) {
      if (!blocking.contains(f.getId())) {
        blocking.add(f.getId());
      }
    }

    List<VotingConfigurationEntity> configs = votingConfigs.findLatestFor(cid);
    if (!configs.isEmpty()) {
      VotingConfigurationEntity config = configs.get(0);
      String purpose = config.getVotingPurpose();
      if (VOTING_PURPOSES_REQUIRING_LEGAL.contains(purpose)) {
        conditions.add(new Condition("voting_legal_opinion",
            "VotingConfiguration.voting_purpose='" + purpose
                + "' requires a legal_opinion_reference.",
            notBlank(config.getLegalOpinionReference())));
      }
    }

    conditions.add(new Condition("terms_document",
        "Draft Terms & Conditions document required.",
        !terms.findByChallengeAndStatuses(cid, DRAFT_OR_LATER_TERMS).isEmpty()));
  }

  private void approvedToPublished(List<Condition> conditions, String cid, ChallengeData data) {
    conditions.add(new Condition("review_to_approved_passed",
        "review_to_approved gate has passed.",
        previousGatePassed(cid, "approved_to_published")));

    conditions.add(new Condition("no_kids_teens_divisions",
        "Children/teens divisions cannot publish — remove them or keep the challenge draft "
            + "until guardian consent is live.",
        !hasKidsDivisions(cid, data)));
  }

  private void entryOpen(List<Condition> conditions, String cid, ChallengeData data) {
    conditions.add(new Condition("approved_to_published_passed",
        "approved_to_published gate has passed.", previousGatePassed(cid, "entry_open")));

    conditions.add(new Condition("no_kids_teens_divisions",
        "Children/teens divisions cannot open for entry — remove them or keep draft until "
            + "guardian consent is live.",
        !hasKidsDivisions(cid, data)));

    conditions.add(new Condition("published_terms",
        "Published Terms & Conditions document required.",
        !terms.findByChallengeAndStatuses(cid, List.of("published")).isEmpty()));

    conditions.add(new Condition("no_pending_regulator_notifications",
        "No pending/overdue regulator notification actions.",
        permitActions.findPendingRegulatorNotifications(cid).isEmpty()));

    if (data != null) {
      Instant start = data.startsAt();
      Instant subEnd = data.submissionEndsAt();
      conditions.add(new Condition("entry_window_set",
          "Start and submission-close dates are set.", start != null && subEnd != null));
      conditions.add(new Condition("entry_window_open",
          "The submission window has not already closed.", isFuture(subEnd)));
      conditions.add(new Condition("entry_window_started",
          "The start date has been reached.", isDue(start)));
    }
  }

  private void votingOpen(List<Condition> conditions, String cid, ChallengeData data) {
    conditions.add(new Condition("entry_open_passed",
        "entry_open gate has passed.", previousGatePassed(cid, "voting_open")));

    conditions.add(new Condition("no_kids_teens_divisions",
        "Children/teens divisions cannot open for voting — remove them or keep draft until "
            + "guardian consent is live.",
        !hasKidsDivisions(cid, data)));

    // With no data supplied, assume voting is used: requiring the config is
    // the safe assumption when we cannot tell.
    boolean votingUsed = data == null || data.votingEndsAt() != null;
    if (votingUsed) {
      conditions.add(new Condition("voting_configuration",
          "VotingConfiguration record required (voting is used).",
          !votingConfigs.findLatestFor(cid).isEmpty()));
    }

    if (data != null) {
      Instant subEnd = data.submissionEndsAt();
      Instant voteEnd = data.votingEndsAt();
      conditions.add(new Condition("voting_window_set",
          "Voting close date is set.", voteEnd != null));
      conditions.add(new Condition("entries_closed",
          "The submission window has closed.", isDue(subEnd)));
      conditions.add(new Condition("voting_window_open",
          "The voting window has not already closed.", isFuture(voteEnd)));
    }
  }

  // ------------------------------------------------------------- passing

  /** The result of trying to pass a gate. */
  public record PassResult(
      boolean passed, List<Map<String, Object>> missing, List<String> blockingFindingIds) {}

  /**
   * Passes a gate and advances the challenge to the stage it unlocks.
   *
   * <p>{@code grandfathered} bypasses the conditions, and exists only for
   * challenges that were already live when the gate system was introduced —
   * re-evaluating those strictly would take running competitions offline.
   * Nothing else may set it.
   */
  public PassResult pass(
      String challengeId,
      String gateCode,
      String actorId,
      String actorEmail,
      ChallengeData data,
      boolean grandfathered) {

    Evaluation evaluation = evaluate(challengeId, gateCode, data);
    if (!evaluation.canPass() && !grandfathered) {
      return new PassResult(false, evaluation.missing(), evaluation.blockingFindingIds());
    }

    String cid = String.valueOf(challengeId);
    Instant now = Instant.now();
    String note = grandfathered
        ? "Grandfathered live — challenge was live before the lifecycle gate system."
        : "";

    List<GateCheckEntity> existing = gateChecks.findLatest(cid, gateCode);
    GateCheckEntity check;
    if (!existing.isEmpty()) {
      check = existing.get(0);
      check.setRelockedReason("");
      check.setNotes(grandfathered ? note : nz(check.getNotes()));
    } else {
      check = new GateCheckEntity();
      check.setId(newId());
      check.setChallengeId(cid);
      check.setGateCode(gateCode);
      check.setNotes(note);
      check.setCreatedDate(now);
      check.setIsSample(false);
    }
    check.setStatus("passed");
    check.setPassedAt(now);
    check.setPassedById(nz(actorId));
    check.setPassedByEmail(nz(actorEmail));
    check.setGrandfathered(grandfathered);
    check.setUpdatedDate(now);
    gateChecks.save(check);

    advanceChallenge(cid, gateCode, now);

    audit.event("gate_passed", cid, nz(actorId), nz(actorEmail),
        "Gate '" + gateCode + "' passed" + (grandfathered ? " (grandfathered live)" : "") + ".");

    return new PassResult(true, List.of(), List.of());
  }

  /**
   * Moves the native challenge to the stage this gate unlocks, and never
   * backwards — a challenge already taking votes must not drop to "published"
   * because an earlier gate was passed late.
   */
  private void advanceChallenge(String cid, String gateCode, Instant now) {
    String target = GATE_TO_LIFECYCLE_STATUS.get(gateCode);
    if (target == null) {
      return;
    }
    Optional<ChallengeEntity> found = challenges.findById(cid);
    if (found.isEmpty()) {
      // An upstream challenge: there is no native row to advance.
      return;
    }
    ChallengeEntity challenge = found.get();
    String current = challenge.getLifecycleStatus() == null
        ? "draft" : challenge.getLifecycleStatus();
    int currentIdx = LIFECYCLE_ORDER.indexOf(current);
    int targetIdx = LIFECYCLE_ORDER.indexOf(target);
    if (targetIdx <= currentIdx) {
      return;
    }
    challenge.setLifecycleStatus(target);
    if (targetIdx >= LIFECYCLE_ORDER.indexOf("published")) {
      // Published means publicly visible, so it leaves draft status too.
      challenge.setStatus("active");
    }
    challenge.setUpdatedDate(now);
    challenges.save(challenge);
  }

  /** Records what was checked and how each condition came out. */
  public void logEvaluation(
      String challengeId, String gateCode, Evaluation evaluation, String actorId, String actorEmail) {

    String summary = evaluation.conditions().stream()
        .map(c -> c.check() + "=" + (c.passed() ? "pass" : "fail"))
        .collect(Collectors.joining("; "));

    audit.event("gate_evaluated", String.valueOf(challengeId), nz(actorId),
        actorEmail == null || actorEmail.isBlank() ? "system" : actorEmail,
        "Gate '" + gateCode + "' evaluated: " + (evaluation.canPass() ? "PASS" : "FAIL")
            + ". Conditions: " + summary + ".");
  }

  // ------------------------------------------------------------- phases

  /** Where a challenge is in its own schedule: upcoming, submit, vote or closed. */
  public String phase(ChallengeData data) {
    if (data == null) {
      return "closed";
    }
    if (isFuture(data.startsAt())) {
      return "upcoming";
    }
    if (isFuture(data.submissionEndsAt())) {
      return "submit";
    }
    if (isFuture(data.votingEndsAt())) {
      return "vote";
    }
    return "closed";
  }

  /**
   * The gates a grandfathered-live challenge may auto-pass, given its phase.
   *
   * <p>An "upcoming" challenge is not live yet, so it gets nothing and is
   * evaluated strictly — grandfathering is for preserving a running
   * competition, not for waving through a future one.
   */
  public List<String> grandfatheredGatesForPhase(String phase) {
    return switch (phase) {
      case "submit" -> List.of(
          "draft_to_review", "review_to_approved", "approved_to_published", "entry_open");
      case "vote", "closed" -> GATE_CODES;
      default -> List.of();
    };
  }

  /** Builds the gate's view of a native challenge row. */
  public ChallengeData toChallengeData(ChallengeEntity c) {
    return new ChallengeData(
        c.getId(),
        firstNonBlank(c.getTheme(), c.getTitle()),
        firstNonBlank(c.getTitle(), c.getTheme()),
        nz(c.getCategory()),
        nz(c.getBrief()),
        c.getStartsAt(),
        c.getSubmissionEndsAt(),
        c.getVotingEndsAt(),
        json.stringList(c.getDivisions()));
  }

  // ------------------------------------------------------------- helpers

  private boolean previousGatePassed(String cid, String gateCode) {
    int order = GATE_CODES.indexOf(gateCode);
    if (order <= 0) {
      return true;
    }
    List<GateCheckEntity> check = gateChecks.findLatest(cid, GATE_CODES.get(order - 1));
    return !check.isEmpty() && "passed".equals(check.get(0).getStatus());
  }

  /**
   * Whether the challenge has a children or teens division.
   *
   * <p>Falls back to the native row when the caller supplied no divisions, so
   * the check cannot be skipped by simply omitting the field.
   */
  private boolean hasKidsDivisions(String cid, ChallengeData data) {
    List<String> divisions = data == null ? null : data.divisions();
    if (divisions == null) {
      divisions = challenges.findById(cid)
          .map(c -> json.stringList(c.getDivisions()))
          .orElseGet(List::of);
    }
    return divisions.stream()
        .anyMatch(d -> d != null && KIDS_DIVISIONS.contains(d.trim().toLowerCase(Locale.ROOT)));
  }

  /** True when the moment exists and has arrived. */
  private static boolean isDue(Instant when) {
    return when != null && !when.isAfter(Instant.now());
  }

  /** True when the moment exists and is still ahead. */
  private static boolean isFuture(Instant when) {
    return when != null && when.isAfter(Instant.now());
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
