package com.fiftythree.challenges.lifecycle;

import com.fiftythree.challenges.entity.ChallengeEntity;
import com.fiftythree.challenges.security.CallerResolver;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RestController;

/**
 * The Java replacement for {@code lifecycleTick}: time-driven advancement of
 * native challenges.
 *
 * <pre>
 *   published   → entry_open   once starts_at is reached
 *   entry_open  → voting_open  once submission_ends_at has passed
 *   voting_open → closed       once voting_ends_at has passed
 * </pre>
 *
 * <p>The clock only makes a transition <em>due</em>; the gate still decides
 * whether it happens. A challenge whose entry window opens today but which has
 * no published terms stays where it is — this endpoint attempts the gate and
 * moves on when it refuses.
 *
 * <p>Closing at the end of voting is the one transition with no gate, because
 * there is no gate after {@code voting_open} and a competition whose voting
 * window has expired must stop accepting votes regardless.
 *
 * <p><b>Authorised, unlike the original.</b> The Base44 version took a request
 * object and went straight to {@code asServiceRole} without checking anything,
 * so anyone who knew the URL could force transitions — closing voting on a
 * live competition, for instance. A scheduler authenticates with
 * {@code X-Tick-Token}; an admin may trigger a tick with their session. Work
 * is still attributed to "system" either way, because the clock decides what
 * moves, not the caller.
 */
@RestController
public class LifecycleTickController {

  private static final Logger log = LoggerFactory.getLogger(LifecycleTickController.class);

  /** The statuses a challenge can still advance from. */
  private static final List<String> ADVANCEABLE =
      List.of("published", "entry_open", "voting_open");

  private static final String SYSTEM_ACTOR = "system";

  private final NativeChallengeQueryRepository challenges;
  private final GateEvaluator gates;
  private final CallerResolver caller;
  private final String tickToken;

  public LifecycleTickController(
      NativeChallengeQueryRepository challenges,
      GateEvaluator gates,
      CallerResolver caller,
      @Value("${app.lifecycle.tick-token:}") String tickToken) {
    this.challenges = challenges;
    this.gates = gates;
    this.caller = caller;
    this.tickToken = tickToken == null ? "" : tickToken.trim();
  }

  /**
   * Whether this caller may advance the lifecycle.
   *
   * <p>Two ways in, because there are two legitimate callers. A scheduler has
   * no session, so it presents {@code X-Tick-Token}; an admin triggering a tick
   * by hand has no token, so their session is accepted instead.
   *
   * <p>Compared in constant time. The comparison is against a shared secret
   * over an endpoint anyone can reach, which is exactly the situation where a
   * short-circuiting {@code equals} leaks the secret a byte at a time.
   */
  private boolean permitted(String sessionToken, String presentedToken) {
    if (!tickToken.isEmpty() && presentedToken != null && MessageDigest.isEqual(
        tickToken.getBytes(StandardCharsets.UTF_8),
        presentedToken.trim().getBytes(StandardCharsets.UTF_8))) {
      return true;
    }
    return caller.isAdmin(sessionToken);
  }

  @PostMapping("/api/apps/{appId}/functions/lifecycleTick")
  public ResponseEntity<?> handle(
      @RequestBody(required = false) Map<String, Object> body,
      @RequestHeader(value = "X-Tick-Token", required = false) String presentedToken) {

    Map<String, Object> request = body == null ? Map.of() : body;
    String sessionToken = request.get("session_token") == null
        ? null : String.valueOf(request.get("session_token")).trim();

    if (!permitted(sessionToken, presentedToken)) {
      // Logged at ERROR because the likeliest cause is a scheduler that was
      // never given the token, and a tick that stops running is invisible —
      // challenges simply never advance, with nothing to show for it.
      log.error("lifecycleTick refused: no admin session and no valid X-Tick-Token. "
          + "If this is the scheduler, set LIFECYCLE_TICK_TOKEN and send it as "
          + "the X-Tick-Token header, or challenges will stop advancing.");
      return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
    }

    try {
      List<ChallengeEntity> due = challenges.findNativeByLifecycleStatuses(ADVANCEABLE);
      List<Map<String, String>> advanced = new ArrayList<>();

      for (ChallengeEntity c : due) {
        String status = c.getLifecycleStatus();

        if ("voting_open".equals(status)) {
          if (isDue(c.getVotingEndsAt())) {
            c.setLifecycleStatus("closed");
            c.setUpdatedDate(Instant.now());
            challenges.save(c);
            advanced.add(Map.of("id", c.getId(), "to", "closed"));
          }
          continue;
        }

        String gateCode = null;
        if ("published".equals(status) && isDue(c.getStartsAt())) {
          gateCode = "entry_open";
        } else if ("entry_open".equals(status) && isDue(c.getSubmissionEndsAt())) {
          gateCode = "voting_open";
        }
        if (gateCode == null) {
          continue;
        }

        GateEvaluator.ChallengeData data = gates.toChallengeData(c);
        GateEvaluator.Evaluation evaluation = gates.evaluate(c.getId(), gateCode, data);
        gates.logEvaluation(c.getId(), gateCode, evaluation, "", SYSTEM_ACTOR);

        GateEvaluator.PassResult result =
            gates.pass(c.getId(), gateCode, "", SYSTEM_ACTOR, data, false);
        if (!result.passed()) {
          continue;
        }

        // passGate already advanced lifecycle_status to the stage the gate
        // unlocks; this only reports it.
        advanced.add(Map.of("id", c.getId(), "to", gateCode));
      }

      Map<String, Object> out = new LinkedHashMap<>();
      out.put("ok", true);
      out.put("checked", due.size());
      out.put("advanced", advanced);
      return ResponseEntity.ok(out);
    } catch (Exception e) {
      log.error("lifecycleTick failed", e);
      return ResponseEntity.status(500).body(Map.of(
          "error", e.getMessage() == null ? "Lifecycle tick failed" : e.getMessage()));
    }
  }

  private static boolean isDue(Instant when) {
    return when != null && !when.isAfter(Instant.now());
  }
}
