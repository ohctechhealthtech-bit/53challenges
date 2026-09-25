package com.fiftythree.challenges.judging;

import com.fasterxml.jackson.databind.JsonNode;
import com.fiftythree.challenges.security.CallerResolver;
import com.fiftythree.challenges.upstream.ChallengeApiClient;
import com.fiftythree.challenges.upstream.ChallengeApiClient.UpstreamResponse;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/**
 * The Java replacement for {@code judgeApi}: the Judging Control Room proxy.
 *
 * <p>Every read and write goes to the parent 53 Challenges judge API; the API
 * key never reaches the browser, which is the reason this indirection exists.
 *
 * <p>The judge is identified by the <em>authenticated</em> address. An admin
 * may pass {@code judge_email} to view on a judge's behalf — a non-admin
 * passing it is ignored, not refused, so the check is that only an admin's
 * value is honoured.
 */
@RestController
public class JudgeApiController {

  private static final Logger log = LoggerFactory.getLogger(JudgeApiController.class);

  private static final Set<String> GET_ACTIONS = Set.of(
      "judge-profile", "judge-overview", "judge-assignments", "judge-entries",
      "judge-queue", "judge-rubric", "judge-panel-progress",
      "judge-variance-alerts", "judge-results", "judge-policies");

  private static final List<String> GET_PARAMS =
      List.of("round_id", "category", "scored", "page", "limit", "entry_id");

  private static final Set<String> POST_ACTIONS =
      Set.of("judge-score", "judge-assignment-respond");

  /** The four scored criteria, each 0–25 in half-point steps. */
  private static final List<String> CRITERIA_KEYS = List.of(
      "originality_creativity", "technical_skill", "emotional_impact", "theme_interpretation");

  private static final double MAX_CRITERION = 25;

  private final ChallengeApiClient upstream;
  private final CallerResolver caller;

  public JudgeApiController(ChallengeApiClient upstream, CallerResolver caller) {
    this.upstream = upstream;
    this.caller = caller;
  }

  @PostMapping("/api/apps/{appId}/functions/judgeApi")
  public ResponseEntity<?> handle(@RequestBody(required = false) Map<String, Object> body) {
    Map<String, Object> request = body == null ? Map.of() : body;
    String sessionToken = str(request.get("session_token"));
    String email = caller.email(sessionToken);
    if (email == null) {
      return ResponseEntity.status(401)
          .body(Map.of("error", "Please sign in to open the judging workspace."));
    }

    // Only an admin may look at another judge's workspace.
    String judgeEmail = email;
    if (caller.isAdmin(sessionToken) && !str(request.get("judge_email")).isEmpty()) {
      judgeEmail = str(request.get("judge_email")).toLowerCase();
    }

    String action = str(request.get("action"));
    try {
      if (GET_ACTIONS.contains(action)) {
        return read(action, judgeEmail, request);
      }
      if (POST_ACTIONS.contains(action)) {
        return write(action, judgeEmail, request);
      }
      return ResponseEntity.badRequest().body(Map.of("error", "Unknown action: " + action));
    } catch (Exception e) {
      log.error("judgeApi action '{}' failed", action, e);
      return ResponseEntity.status(500).body(Map.of("error", e.getMessage()));
    }
  }

  private ResponseEntity<?> read(String action, String judgeEmail, Map<String, Object> request) {
    Map<String, String> params = new LinkedHashMap<>();
    params.put("judge_email", judgeEmail);
    for (String key : GET_PARAMS) {
      String value = str(request.get(key));
      if (!value.isEmpty()) {
        params.put(key, value);
      }
    }

    UpstreamResponse res = upstream.getFrom(upstream.sibling("publicChallengeApi"), action, params);
    if (res.status() / 100 != 2) {
      return ResponseEntity.ok(upstreamError(res));
    }
    return ResponseEntity.ok(res.body());
  }

  private ResponseEntity<?> write(String action, String judgeEmail, Map<String, Object> request) {
    Map<String, Object> payload = new LinkedHashMap<>();
    payload.put("action", action);
    payload.put("judge_email", judgeEmail);

    if ("judge-score".equals(action)) {
      Map<String, Object> criteria = asMap(request.get("criteria"));
      Map<String, Double> clean = new LinkedHashMap<>();
      for (String key : CRITERIA_KEYS) {
        Double value = validScore(criteria.get(key));
        if (value == null) {
          // One message for every invalid case: the judge needs to know the
          // rule, not which of four fields tripped it.
          return ResponseEntity.ok(Map.of(
              "error", "Each score must be between 0 and 25, in steps of 0.5."));
        }
        clean.put(key, value);
      }
      if (str(request.get("entry_id")).isEmpty() || str(request.get("round_id")).isEmpty()) {
        return ResponseEntity.ok(Map.of(
            "error", "entry_id and round_id are required to submit a score."));
      }
      payload.put("entry_id", str(request.get("entry_id")));
      payload.put("round_id", str(request.get("round_id")));
      payload.put("criteria", clean);
    }

    if ("judge-assignment-respond".equals(action)) {
      String response = str(request.get("response"));
      if (str(request.get("assignment_id")).isEmpty()
          || !("accepted".equals(response) || "declined".equals(response))) {
        return ResponseEntity.ok(Map.of("error", "A valid assignment and response are required."));
      }
      payload.put("assignment_id", str(request.get("assignment_id")));
      payload.put("response", response);
      if (!str(request.get("round_id")).isEmpty()) {
        payload.put("round_id", str(request.get("round_id")));
      }
    }

    UpstreamResponse res = upstream.postTo(upstream.sibling("publicChallengeApi"), payload);
    if (res.status() / 100 != 2 || !res.body().path("error").asText("").isEmpty()) {
      return ResponseEntity.ok(Map.of(
          "error", firstNonBlank(res.body().path("error").asText(""),
              "The judging service could not save this (" + res.status() + ")."),
          "upstream_status", res.status()));
    }
    return ResponseEntity.ok(res.body());
  }

  /**
   * A score between 0 and 25 in half-point steps, or null when it is not one.
   *
   * <p>The step check is done by doubling rather than with a modulus on a
   * fraction: 0.1 has no exact binary representation, so {@code v % 0.5} does
   * not reliably equal zero for values a judge legitimately entered.
   */
  private static Double validScore(Object raw) {
    if (raw == null) {
      return null;
    }
    double v;
    try {
      v = Double.parseDouble(String.valueOf(raw));
    } catch (NumberFormatException e) {
      return null;
    }
    if (!Double.isFinite(v) || v < 0 || v > MAX_CRITERION) {
      return null;
    }
    if (Math.rint(v * 2) != v * 2) {
      return null;
    }
    return v;
  }

  /**
   * Turns an upstream failure into something a judge can act on.
   *
   * <p>"Unknown action" means the parent has not switched that endpoint on
   * yet, which is a very different thing from a broken request — relaying it
   * raw would tell a judge their workspace is broken when it simply is not
   * available yet.
   */
  private static Map<String, Object> upstreamError(UpstreamResponse res) {
    JsonNode body = res.body();
    String error = body.path("error").asText("");
    if (error.toLowerCase().contains("unknown action")) {
      return Map.of(
          "error", "The 53 Challenges judging service does not offer this yet — the judge "
              + "endpoints are still being switched on. Please check back soon.",
          "upstream_status", res.status());
    }
    return Map.of(
        "error", firstNonBlank(error,
            "The judging service returned an error (" + res.status() + ")."),
        "upstream_status", res.status());
  }

  @SuppressWarnings("unchecked")
  private static Map<String, Object> asMap(Object v) {
    return v instanceof Map<?, ?> m ? (Map<String, Object>) m : Map.of();
  }

  private static String firstNonBlank(String... values) {
    for (String v : values) {
      if (v != null && !v.isBlank()) {
        return v;
      }
    }
    return "";
  }

  private static String str(Object v) {
    return v == null ? "" : String.valueOf(v);
  }
}
