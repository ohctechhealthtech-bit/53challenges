package com.fiftythree.challenges.lifecycle;

import com.fiftythree.challenges.entity.ChallengeEntity;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
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
 * <p>Called by a scheduler, not by a person, so it takes no session and
 * attributes its work to "system".
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

  public LifecycleTickController(NativeChallengeQueryRepository challenges, GateEvaluator gates) {
    this.challenges = challenges;
    this.gates = gates;
  }

  @PostMapping("/api/apps/{appId}/functions/lifecycleTick")
  public ResponseEntity<?> handle(@RequestBody(required = false) Map<String, Object> body) {
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
