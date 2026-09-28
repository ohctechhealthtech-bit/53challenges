package com.fiftythree.challenges.vote;

import com.fiftythree.challenges.security.CallerResolver;
import com.fiftythree.challenges.support.ApiErrors;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/**
 * The Java replacement for the {@code challengeVotes} Base44 function, mounted
 * at that function's own URL so the cutover is an nginx change alone.
 *
 * <pre>
 *   {challenge_id, user_email}                  -> {votedEntryIds, counts, excludedCount}
 *   {action: 'totals', challenge_ids: [...]}    -> {totals: {id: n}}          (public)
 *   {action: 'totals'}  (no ids)                -> {total, excluded}          (admin)
 * </pre>
 *
 * <p>Vote counts are public on purpose: the challenge cards and the challenge
 * page must show the same numbers, and those numbers are displayed to everyone
 * anyway.
 */
@RestController
public class ChallengeVotesController {

  private static final Logger log = LoggerFactory.getLogger(ChallengeVotesController.class);

  /** Matches the original's cap on how many challenges one call may total up. */
  private static final int MAX_IDS = 100;

  private final VoteRepository votes;
  private final CallerResolver caller;

  public ChallengeVotesController(VoteRepository votes, CallerResolver caller) {
    this.votes = votes;
    this.caller = caller;
  }

  @PostMapping("/api/apps/{appId}/functions/challengeVotes")
  public ResponseEntity<?> handle(@RequestBody(required = false) Map<String, Object> body) {
    Map<String, Object> request = body == null ? Map.of() : body;

    try {
      if ("totals".equals(String.valueOf(request.get("action")))) {
        return totals(request);
      }

      String challengeId = str(request.get("challenge_id"));
      if (challengeId.isEmpty()) {
        return ResponseEntity.badRequest().body(Map.of("error", "Missing challenge_id"));
      }
      return ResponseEntity.ok(perChallenge(challengeId, str(request.get("user_email"))));
    } catch (Exception e) {
      log.error("challengeVotes failed", e);
      return ApiErrors.internal(e);
    }
  }

  private ResponseEntity<?> totals(Map<String, Object> request) {
    Object raw = request.get("challenge_ids");
    List<?> rawIds = raw instanceof List<?> list ? list : List.of();

    if (!rawIds.isEmpty()) {
      // De-duplicate, drop blanks, cap — in that order, as the original did.
      LinkedHashSet<String> ids = new LinkedHashSet<>();
      for (Object o : rawIds) {
        String id = str(o);
        if (!id.isEmpty() && ids.size() < MAX_IDS) {
          ids.add(id);
        }
      }

      // Every requested id appears in the response, including the ones with no
      // votes: the original seeded each key, and a client that reads
      // totals[id] would otherwise get undefined instead of 0.
      Map<String, Long> totals = new LinkedHashMap<>();
      for (String id : ids) {
        totals.put(id, 0L);
      }
      if (!ids.isEmpty()) {
        for (Object[] row : votes.totalsByChallenge(ids)) {
          totals.put((String) row[0], (Long) row[1]);
        }
      }
      return ResponseEntity.ok(Map.of("totals", totals));
    }

    // No ids: the site-wide aggregate, which is admin-only.
    //
    // The original checked ONLY for a Base44 platform admin here, unlike every
    // other admin path in this codebase, which goes through isAdminCaller and
    // accepts the app's own Challenge-API session. That looks like an oversight
    // rather than intent — it would have refused the app's own admins. This
    // uses the same rule as everywhere else: a caller whose local User record
    // carries an admin role, via either login.
    if (!caller.isAdmin(str(request.get("session_token")))) {
      return ResponseEntity.status(403).body(Map.of("error", "Forbidden"));
    }
    return ResponseEntity.ok(Map.of(
        "total", votes.countAllValid(),
        "excluded", votes.countAllExcluded()));
  }

  private Map<String, Object> perChallenge(String challengeId, String rawEmail) {
    Map<String, Long> counts = new LinkedHashMap<>();
    for (Object[] row : votes.countsByEntry(challengeId)) {
      counts.put((String) row[0], (Long) row[1]);
    }

    String email = rawEmail.trim().toLowerCase();
    List<String> votedEntryIds =
        email.isEmpty() ? new ArrayList<>() : votes.votedEntryIds(challengeId, email);

    return Map.of(
        "votedEntryIds", votedEntryIds,
        "counts", counts,
        "excludedCount", votes.countExcluded(challengeId));
  }

  private static String str(Object v) {
    return v == null ? "" : String.valueOf(v);
  }
}
