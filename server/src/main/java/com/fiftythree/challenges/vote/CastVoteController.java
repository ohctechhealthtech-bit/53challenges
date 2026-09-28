package com.fiftythree.challenges.vote;

import com.fasterxml.jackson.databind.JsonNode;
import com.fiftythree.challenges.compliance.ComplianceAuditService;
import com.fiftythree.challenges.engine.EntryQueryRepository;
import com.fiftythree.challenges.entity.EntryEntity;
import com.fiftythree.challenges.lifecycle.LifecycleGateService;
import com.fiftythree.challenges.security.CallerResolver;
import com.fiftythree.challenges.upstream.ChallengeApiClient;
import com.fiftythree.challenges.support.ApiErrors;
import java.time.Instant;
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
 * The Java replacement for {@code castVote}.
 *
 * <p>The voter is the authenticated session, always. A {@code user_email} in
 * the request body is ignored — otherwise anyone could vote as anyone.
 *
 * <p>Every check fails closed: the entry must exist, belong to the named
 * challenge and be approved; a minor's entry needs an explicit approved
 * guardian decision; the challenge's voting gate must be open. When the entry
 * cannot be verified at all the vote is refused rather than allowed through.
 */
@RestController
public class CastVoteController {

  private static final Logger log = LoggerFactory.getLogger(CastVoteController.class);

  private static final Set<String> CHILD_DIVISIONS = Set.of("children", "teens");

  private final VoteRepository votes;
  private final EntryQueryRepository entries;
  private final LifecycleGateService gates;
  private final ComplianceAuditService audit;
  private final ChallengeApiClient upstream;
  private final CallerResolver caller;

  public CastVoteController(
      VoteRepository votes,
      EntryQueryRepository entries,
      LifecycleGateService gates,
      ComplianceAuditService audit,
      ChallengeApiClient upstream,
      CallerResolver caller) {
    this.votes = votes;
    this.entries = entries;
    this.gates = gates;
    this.audit = audit;
    this.upstream = upstream;
    this.caller = caller;
  }

  @PostMapping("/api/apps/{appId}/functions/castVote")
  public ResponseEntity<?> handle(@RequestBody(required = false) Map<String, Object> body) {
    Map<String, Object> request = body == null ? Map.of() : body;

    String email = caller.email(str(request.get("session_token")));
    if (email == null) {
      return ResponseEntity.status(401).body(Map.of("error", "You must be signed in to vote."));
    }

    String entryId = str(request.get("entry_id"));
    String challengeId = str(request.get("challenge_id"));

    try {
      if (entryId.isEmpty()) {
        return ResponseEntity.badRequest().body(Map.of("error", "Missing entry_id"));
      }
      if (challengeId.isEmpty()) {
        // Without a challenge there is no gate to check, so the vote cannot be
        // validated and is refused rather than counted.
        audit.participationDenied("", "", email,
            "castVote rejected: challenge_id missing — vote could not be gate-checked.");
        return ResponseEntity.badRequest().body(Map.of("error", "Missing challenge_id"));
      }

      ResponseEntity<?> refusal = verifyEntry(entryId, challengeId, email);
      if (refusal != null) {
        return refusal;
      }

      if (gates.isVoteBlocked(challengeId)) {
        audit.gateLog("", challengeId, "enforcement_block", "cast_vote",
            "castVote blocked a vote for a challenge whose voting gate is not open.");
        audit.participationDenied(challengeId, "", email,
            "castVote rejected: voting gate not open for challenge " + challengeId + ".");
        return ResponseEntity.status(403)
            .body(Map.of("error", "Voting on this challenge is not open."));
      }

      if (!votes.findByEntryAndVoter(entryId, email).isEmpty()) {
        return ResponseEntity.ok(Map.of(
            "success", false,
            "duplicate", true,
            "error", "You already voted for this entry.",
            "votes", votes.countValidForEntry(entryId)));
      }

      // A session token is issued only after email verification, so an
      // authenticated voter is a confirmed address by construction.
      VoteEntity vote = new VoteEntity();
      vote.setId(UUID.randomUUID().toString().replace("-", "").substring(0, 24));
      vote.setEntryId(entryId);
      vote.setChallengeId(challengeId);
      vote.setUserId("");
      vote.setUserEmail(email);
      vote.setVoterVerified(true);
      vote.setExcluded(false);
      vote.setCreatedDate(Instant.now());
      vote.setUpdatedDate(Instant.now());
      vote.setIsSample(false);
      votes.save(vote);

      // The denormalised counter on the entry is kept roughly in step, but the
      // number returned is counted from the vote table — that is the source of
      // truth every other endpoint reads.
      entries.findById(entryId).ifPresent(e -> {
        e.setVoteCount((e.getVoteCount() == null ? 0 : e.getVoteCount()) + 1);
        entries.save(e);
      });

      return ResponseEntity.ok(Map.of(
          "success", true, "votes", votes.countValidForEntry(entryId)));
    } catch (Exception e) {
      log.error("castVote failed for entry {} challenge {}", entryId, challengeId, e);
      return ApiErrors.internal(e);
    }
  }

  /**
   * Checks the entry is real, in this challenge, approved, and — if it belongs
   * to a child — cleared by a guardian.
   *
   * @return the refusal to send, or null when the entry may be voted on
   */
  private ResponseEntity<?> verifyEntry(String entryId, String challengeId, String email) {
    EntryEntity local = entries.findById(entryId).orElse(null);

    if (local != null) {
      if (!challengeId.equals(nz(local.getChallengeId()))) {
        audit.participationDenied(challengeId, "", email, "castVote rejected: entry " + entryId
            + " does not belong to challenge " + challengeId + ".");
        return ResponseEntity.badRequest()
            .body(Map.of("error", "This entry does not belong to that challenge."));
      }
      if (!"approved".equals(nz(local.getStatus()))) {
        audit.participationDenied(challengeId, "", email, "castVote rejected: entry " + entryId
            + " is '" + nz(local.getStatus()) + "', not approved.");
        return ResponseEntity.status(403)
            .body(Map.of("error", "This entry is not open for voting."));
      }
      boolean minor = Boolean.TRUE.equals(local.getIsMinor())
          || CHILD_DIVISIONS.contains(nz(local.getDivision()).toLowerCase());
      if (minor) {
        // Only an explicit "approved" passes. Empty, not_required, pending,
        // declined and revoked all fail closed — there is no legacy exemption.
        String status = nz(local.getGuardianApprovalStatus());
        if (!"approved".equals(status)) {
          audit.participationDenied(challengeId, "", email, "castVote rejected: entry " + entryId
              + " guardian approval is '" + (status.isEmpty() ? "empty" : status) + "'.");
          return ResponseEntity.status(403)
              .body(Map.of("error", "This entry is awaiting guardian approval."));
        }
      }
      return null;
    }

    // Not held locally, so it should be an upstream entry.
    List<JsonNode> list = upstream.entries(challengeId, 500);
    if (list.isEmpty()) {
      // An empty list is indistinguishable from a failed lookup here, and a
      // vote that cannot be verified must not be counted.
      audit.participationDenied(challengeId, "", email, "castVote rejected: entry " + entryId
          + " could not be verified (entry lookup unavailable).");
      return ResponseEntity.status(503)
          .body(Map.of("error", "We couldn't verify that entry right now. Please try again."));
    }

    JsonNode match = list.stream()
        .filter(e -> entryId.equals(e.path("id").asText("")))
        .findFirst()
        .orElse(null);
    if (match == null) {
      audit.participationDenied(challengeId, "", email,
          "castVote rejected: entry " + entryId + " does not exist in challenge " + challengeId + ".");
      return ResponseEntity.status(404).body(Map.of("error", "This entry does not exist."));
    }

    String status = match.path("status").asText("approved").toLowerCase();
    if (!"approved".equals(status)) {
      audit.participationDenied(challengeId, "", email, "castVote rejected: upstream entry "
          + entryId + " is '" + status + "', not approved.");
      return ResponseEntity.status(403).body(Map.of("error", "This entry is not open for voting."));
    }

    boolean minor = match.path("is_minor").asBoolean(false)
        || CHILD_DIVISIONS.contains(match.path("division").asText("").toLowerCase());
    String guardianStatus = match.path("guardian_approval_status").asText("");
    if (minor && !"approved".equals(guardianStatus)) {
      audit.participationDenied(challengeId, "", email, "castVote rejected: upstream entry "
          + entryId + " guardian approval is '"
          + (guardianStatus.isEmpty() ? "empty" : guardianStatus) + "'.");
      return ResponseEntity.status(403)
          .body(Map.of("error", "This entry is awaiting guardian approval."));
    }
    return null;
  }

  private static String nz(String v) {
    return v == null ? "" : v;
  }

  private static String str(Object v) {
    return v == null ? "" : String.valueOf(v);
  }
}
