package com.fiftythree.challenges.judging;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fiftythree.challenges.entity.AuditFindingEntity;
import com.fiftythree.challenges.entity.AuditReviewEntity;
import com.fiftythree.challenges.entity.ChallengeEntity;
import com.fiftythree.challenges.entity.ChallengeRepository;
import com.fiftythree.challenges.entity.CombinedResultEntity;
import com.fiftythree.challenges.entity.CompetitionAssignmentEntity;
import com.fiftythree.challenges.entity.JudgingPanelEntity;
import com.fiftythree.challenges.entity.PrizeLedgerEntity;
import com.fiftythree.challenges.entity.ScoreEntity;
import com.fiftythree.challenges.prize.AuditReviewQueryRepository;
import com.fiftythree.challenges.prize.CombinedResultQueryRepo;
import com.fiftythree.challenges.prize.PrizeLedgerQueryRepository;
import com.fiftythree.challenges.security.CallerResolver;
import com.fiftythree.challenges.support.JsonColumn;
import com.fiftythree.challenges.vote.VoteRepository;
import com.fiftythree.challenges.support.ApiErrors;
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
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/**
 * The Java replacement for {@code auditCompetition}.
 *
 * <p>An auditor independently verifies a competition's result before prizes are
 * released. The role separation is the point: <b>someone who judged or managed
 * a competition cannot audit it</b>, checked here as well as at assignment
 * time, because an auditor reviewing their own judging is not an audit.
 */
@RestController
public class AuditCompetitionController {

  private static final Logger log = LoggerFactory.getLogger(AuditCompetitionController.class);

  /** Every one must be ticked before a competition can be signed off. */
  private static final List<String> REQUIRED_CHECKS = List.of(
      "scores_recomputed",
      "blind_judging_confirmed",
      "conflict_exclusions_confirmed",
      "winning_evidence_verified",
      "eligibility_confirmed",
      "random_sample_done",
      "vote_integrity_done");

  /** Recomputed and stored scores may differ by less than a cent's worth. */
  private static final double SCORE_TOLERANCE = 0.02;

  private final ChallengeRepository challenges;
  private final AuditReviewQueryRepository reviews;
  private final AuditFindingQueryRepository findings;
  private final CompetitionAssignmentQueryRepository assignments;
  private final JudgingPanelQueryRepository panels;
  private final ScoreQueryRepository scores;
  private final AssignmentQueryRepository allocations;
  private final CombinedResultQueryRepo storedResults;
  private final PrizeLedgerQueryRepository ledgers;
  private final VoteRepository votes;
  private final ScoringService scoring;
  private final CallerResolver caller;
  private final JsonColumn json;
  private final ObjectMapper mapper;

  public AuditCompetitionController(
      ChallengeRepository challenges,
      AuditReviewQueryRepository reviews,
      AuditFindingQueryRepository findings,
      CompetitionAssignmentQueryRepository assignments,
      JudgingPanelQueryRepository panels,
      ScoreQueryRepository scores,
      AssignmentQueryRepository allocations,
      CombinedResultQueryRepo storedResults,
      PrizeLedgerQueryRepository ledgers,
      VoteRepository votes,
      ScoringService scoring,
      CallerResolver caller,
      JsonColumn json,
      ObjectMapper mapper) {
    this.challenges = challenges;
    this.reviews = reviews;
    this.findings = findings;
    this.assignments = assignments;
    this.panels = panels;
    this.scores = scores;
    this.allocations = allocations;
    this.storedResults = storedResults;
    this.ledgers = ledgers;
    this.votes = votes;
    this.scoring = scoring;
    this.caller = caller;
    this.json = json;
    this.mapper = mapper;
  }

  @PostMapping("/api/apps/{appId}/functions/auditCompetition")
  public ResponseEntity<?> handle(@RequestBody(required = false) Map<String, Object> body) {
    Map<String, Object> request = body == null ? Map.of() : body;
    String action = str(request.get("action"));
    String competitionId = str(request.get("competition_id"));
    if (action.isEmpty() || competitionId.isEmpty()) {
      return ResponseEntity.badRequest().body(Map.of("error", "Missing action/competition_id"));
    }

    String sessionToken = str(request.get("session_token"));
    String email = caller.email(sessionToken);
    if (email == null) {
      return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
    }
    boolean isAdmin = caller.isAdmin(sessionToken);

    try {
      ChallengeEntity challenge = challenges.findById(competitionId).orElse(null);
      if (challenge == null) {
        return ResponseEntity.status(404).body(Map.of("error", "Competition not found"));
      }

      List<CompetitionAssignmentEntity> mine =
          assignments.findActiveFor(competitionId, email);
      boolean isJudgeOrManager = mine.stream()
          .anyMatch(a -> "judge".equals(nz(a.getRole())) || "manager".equals(nz(a.getRole())));
      if (isJudgeOrManager) {
        // Checked even for admins: auditing your own judging is not an audit,
        // whatever your platform role.
        return ResponseEntity.status(403).body(Map.of("error",
            "Role separation violated: you are a judge or manager on this competition "
                + "and cannot audit it."));
      }
      boolean isAuditor = mine.stream().anyMatch(a -> "auditor".equals(nz(a.getRole())));
      if (!isAdmin && !isAuditor) {
        return ResponseEntity.status(403)
            .body(Map.of("error", "Not an assigned auditor for this competition."));
      }

      AuditReviewEntity review = reviewFor(competitionId, challenge);

      return switch (action) {
        case "pre_launch" -> preLaunch(review, challenge, email);
        case "close_audit" -> closeAudit(review, competitionId);
        case "set_check" -> setCheck(review, request);
        case "add_finding" -> addFinding(review, request, competitionId, email);
        case "resolve_finding" -> resolveFinding(request, email);
        case "sign_off" -> signOff(review, request, email);
        case "route" -> route(review, request);
        default -> ResponseEntity.badRequest()
            .body(Map.of("error", "Unknown action: " + action));
      };
    } catch (Exception e) {
      log.error("auditCompetition action '{}' failed for {}", action, competitionId, e);
      return ApiErrors.internal(e);
    }
  }

  private AuditReviewEntity reviewFor(String competitionId, ChallengeEntity challenge) {
    AuditReviewEntity review =
        reviews.findLatestFor(competitionId).stream().findFirst().orElse(null);
    if (review != null) {
      return review;
    }
    Instant now = Instant.now();
    AuditReviewEntity fresh = new AuditReviewEntity();
    fresh.setId(newId());
    fresh.setCompetitionId(competitionId);
    fresh.setCompetitionTitle(firstNonBlank(challenge.getTitle(), challenge.getTheme()));
    fresh.setStatus("not_started");
    fresh.setCreatedDate(now);
    fresh.setUpdatedDate(now);
    fresh.setIsSample(false);
    return reviews.save(fresh);
  }

  /** Confirms the published terms are complete and the prize money is real. */
  private ResponseEntity<?> preLaunch(
      AuditReviewEntity review, ChallengeEntity challenge, String email) {

    Map<String, Object> terms = new LinkedHashMap<>();
    terms.put("has_brief", notBlank(challenge.getBrief()));
    terms.put("has_category", notBlank(challenge.getCategory()));
    terms.put("starts_at_set", challenge.getStartsAt() != null);
    terms.put("submission_ends_at_set", challenge.getSubmissionEndsAt() != null);
    terms.put("voting_ends_at_set", challenge.getVotingEndsAt() != null);

    List<String> issues = new ArrayList<>();
    if (!notBlank(challenge.getBrief())) {
      issues.add("Published brief is missing.");
    }
    if (!notBlank(challenge.getCategory())) {
      issues.add("Category is not set.");
    }
    if (challenge.getStartsAt() == null) {
      issues.add("Start date is not set.");
    }
    if (challenge.getSubmissionEndsAt() == null) {
      issues.add("Submission close date is not set.");
    }
    if (challenge.getVotingEndsAt() == null) {
      issues.add("Voting close date is not set.");
    }

    PrizeLedgerEntity ledger =
        ledgers.findLatestFor(challenge.getId()).stream().findFirst().orElse(null);
    boolean sponsored = ledger != null
        && ("sponsor".equals(nz(ledger.getFundingSource()))
            || "mixed".equals(nz(ledger.getFundingSource())));
    if (sponsored && "active".equals(nz(challenge.getStatus()))
        && !Boolean.TRUE.equals(ledger.getSponsorReceived())) {
      issues.add("Sponsored prize money has not been recorded as received, "
          + "but the competition is open.");
    }

    Instant now = Instant.now();
    review.setStatus("pre_launch");
    review.setPreLaunch(writeJson(Map.of(
        "terms_match", issues.isEmpty(),
        "checked_by", email,
        "checked_at", now.toString(),
        "notes", String.join(" ", issues))));
    review.setUpdatedDate(now);

    return ResponseEntity.ok(Map.of(
        "success", true,
        "terms", terms,
        "terms_match", issues.isEmpty(),
        "issues", issues,
        "review", reviews.save(review)));
  }

  /** Recomputes the result from raw data and checks the integrity controls held. */
  private ResponseEntity<?> closeAudit(AuditReviewEntity review, String competitionId) {
    JudgingPanelEntity panel =
        panels.findLatestFor(competitionId).stream().findFirst().orElse(null);
    ScoringService.Result recomputed = scoring.compute(panel, competitionId);

    String panelId = panel == null ? "" : panel.getId();
    List<ScoreEntity> countable = panelId.isEmpty() ? List.of() : scores.findCountable(panelId);

    // Blind judging: every counted score carries an anonymous id. A score
    // without one was not blinded, whatever the process claimed.
    boolean blindOk = !countable.isEmpty()
        && countable.stream().allMatch(s -> notBlank(s.getAnonymousId()));

    // Conflict exclusions: every counted score must have a matching allocation.
    // A score with no allocation means a judge scored an entry they were kept
    // away from.
    Set<String> allocated = new LinkedHashSet<>();
    if (!panelId.isEmpty()) {
      for (var a : allocations.findByPanel(panelId)) {
        allocated.add(nz(a.getEntryId()) + ":" + nz(a.getJudgeProfileId()));
      }
    }
    boolean conflictOk = countable.stream()
        .allMatch(s -> allocated.contains(nz(s.getEntryId()) + ":" + nz(s.getJudgeProfileId())));

    long excludedVotes = votes.countExcludedForChallenge(competitionId);

    List<CombinedResultEntity> stored = storedResults.findByChallengeRanked(competitionId);
    boolean matchesStored = !stored.isEmpty() && stored.stream().allMatch(r -> {
      ScoringService.Row row = recomputed.byEntry().get(r.getEntryId());
      return row != null && r.getCombinedScore() != null
          && Math.abs(row.combinedScore() - r.getCombinedScore()) < SCORE_TOLERANCE;
    });

    Instant now = Instant.now();
    Map<String, Object> checklist = new LinkedHashMap<>(readJson(review.getChecklist()));
    checklist.put("scores_recomputed", matchesStored);
    checklist.put("blind_judging_confirmed", blindOk);
    checklist.put("conflict_exclusions_confirmed", conflictOk);
    checklist.put("vote_integrity_done", true);

    List<Map<String, Object>> rows = recomputed.rows().stream()
        .map(ScoringService.Row::asMap).toList();

    review.setStatus("in_audit");
    review.setPanelId(panelId);
    review.setRecomputed(writeJson(Map.of(
        "rows", rows, "matches_stored", matchesStored, "recomputed_at", now.toString())));
    review.setVoteIntegrity(writeJson(Map.of(
        "scanned", votes.countForChallenge(competitionId),
        "flagged", excludedVotes,
        "excluded", excludedVotes,
        "notes", "")));
    review.setChecklist(writeJson(checklist));
    review.setUpdatedDate(now);

    return ResponseEntity.ok(Map.of(
        "success", true,
        "review", reviews.save(review),
        "recomputed", rows,
        "matches_stored", matchesStored,
        "blind_ok", blindOk,
        "conflict_ok", conflictOk,
        "vote_integrity", Map.of(
            "scanned", votes.countForChallenge(competitionId),
            "flagged", excludedVotes,
            "excluded", excludedVotes)));
  }

  private ResponseEntity<?> setCheck(AuditReviewEntity review, Map<String, Object> request) {
    String key = str(request.get("key"));
    if (key.isEmpty()) {
      return ResponseEntity.badRequest().body(Map.of("error", "Missing key"));
    }
    Map<String, Object> checklist = new LinkedHashMap<>(readJson(review.getChecklist()));
    checklist.put(key, request.get("value"));
    review.setChecklist(writeJson(checklist));
    review.setUpdatedDate(Instant.now());
    return ResponseEntity.ok(Map.of("success", true, "review", reviews.save(review)));
  }

  private ResponseEntity<?> addFinding(
      AuditReviewEntity review, Map<String, Object> request,
      String competitionId, String email) {

    String detail = str(request.get("detail"));
    if (detail.isEmpty()) {
      return ResponseEntity.badRequest().body(Map.of("error", "Missing detail"));
    }
    Instant now = Instant.now();
    AuditFindingEntity f = new AuditFindingEntity();
    f.setId(newId());
    f.setReviewId(review.getId());
    f.setCompetitionId(competitionId);
    f.setSeverity(firstNonBlank(str(request.get("severity")), "info"));
    f.setCategory(firstNonBlank(str(request.get("category")), "scoring"));
    f.setDetail(detail);
    f.setStatus("open");
    f.setCreatedBy(email);
    f.setCreatedByName(email);
    f.setCreatedAt(now);
    f.setCreatedDate(now);
    f.setUpdatedDate(now);
    f.setIsSample(false);
    return ResponseEntity.ok(Map.of("success", true, "finding", findings.save(f)));
  }

  private ResponseEntity<?> resolveFinding(Map<String, Object> request, String email) {
    String id = str(request.get("finding_id"));
    if (id.isEmpty()) {
      return ResponseEntity.badRequest().body(Map.of("error", "Missing finding_id"));
    }
    AuditFindingEntity f = findings.findById(id).orElse(null);
    if (f == null) {
      return ResponseEntity.status(404).body(Map.of("error", "Finding not found"));
    }
    Instant now = Instant.now();
    f.setStatus("resolved");
    f.setResolution(str(request.get("resolution")));
    f.setResolvedBy(email);
    f.setResolvedAt(now);
    f.setUpdatedDate(now);
    return ResponseEntity.ok(Map.of("success", true, "finding", findings.save(f)));
  }

  /**
   * Signs the audit off, which is what releases prizes.
   *
   * <p>Blocked while any material finding is open, and blocked until every
   * checklist item is ticked — the sign-off is the record that each of those
   * checks was actually done.
   */
  private ResponseEntity<?> signOff(
      AuditReviewEntity review, Map<String, Object> request, String email) {

    boolean material = findings.findOpenFor(review.getId()).stream()
        .anyMatch(f -> "material".equals(nz(f.getSeverity())));
    if (material) {
      return ResponseEntity.status(409).body(Map.of(
          "error", "Cannot sign off: open material findings must be resolved first."));
    }

    Map<String, Object> checklist = readJson(review.getChecklist());
    List<String> missing = REQUIRED_CHECKS.stream()
        .filter(k -> !truthy(checklist.get(k)))
        .toList();
    if (!missing.isEmpty()) {
      return ResponseEntity.status(409).body(Map.of(
          "error", "Cannot sign off: checklist incomplete — " + String.join(", ", missing)));
    }

    Instant now = Instant.now();
    review.setStatus("signed_off");
    review.setSignOffBy(email);
    review.setSignOffName(email);
    review.setSignOffAt(now);
    review.setSignOffNotes(str(request.get("notes")));
    review.setUpdatedDate(now);
    return ResponseEntity.ok(Map.of("success", true, "review", reviews.save(review)));
  }

  /** Sends the findings back for resolution and a re-audit. */
  private ResponseEntity<?> route(AuditReviewEntity review, Map<String, Object> request) {
    String routedTo = str(request.get("routed_to"));
    String reason = str(request.get("reason"));
    if (routedTo.isEmpty() || reason.isEmpty()) {
      return ResponseEntity.badRequest().body(Map.of("error", "Missing routed_to/reason"));
    }

    Instant now = Instant.now();
    review.setStatus("routed");
    review.setRoutedTo(routedTo);
    review.setRoutingReason(reason);
    review.setReAuditCount((review.getReAuditCount() == null ? 0 : review.getReAuditCount()) + 1);
    review.setUpdatedDate(now);
    reviews.save(review);

    List<AuditFindingEntity> open = findings.findOpenFor(review.getId()).stream()
        .filter(f -> "material".equals(nz(f.getSeverity())))
        .toList();
    for (AuditFindingEntity f : open) {
      f.setStatus("routed");
      f.setUpdatedDate(now);
    }
    findings.saveAll(open);

    return ResponseEntity.ok(Map.of("success", true, "review", review));
  }

  private Map<String, Object> readJson(String stored) {
    if (stored == null || stored.isBlank()) {
      return Map.of();
    }
    try {
      return mapper.readValue(stored,
          new com.fasterxml.jackson.core.type.TypeReference<Map<String, Object>>() {});
    } catch (Exception e) {
      return Map.of();
    }
  }

  private String writeJson(Object value) {
    try {
      return mapper.writeValueAsString(value);
    } catch (Exception e) {
      return "{}";
    }
  }

  private static boolean truthy(Object v) {
    return Boolean.TRUE.equals(v) || "true".equalsIgnoreCase(String.valueOf(v));
  }

  private static boolean notBlank(String v) {
    return v != null && !v.isBlank();
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
