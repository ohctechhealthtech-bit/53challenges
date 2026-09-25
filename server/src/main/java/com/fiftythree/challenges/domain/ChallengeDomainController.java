package com.fiftythree.challenges.domain;

import com.fiftythree.challenges.security.CallerResolver;
import com.fiftythree.challenges.upstream.ChallengeApiClient;
import java.util.HashMap;
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
 * The Java replacement for the {@code challengeDomains} Base44 function.
 *
 * <p><b>Mounted at the Base44 function's own URL</b>, on purpose. The React
 * client reaches it through the SDK as
 * {@code /api/apps/{appId}/functions/challengeDomains}, so serving that exact
 * path means the cutover needs no frontend rebuild and no redeploy: nginx sends
 * this one path to Java and everything else still goes to Base44. Rolling back
 * is deleting the nginx block. Changing the client instead would couple the
 * rollback to a redeploy, which is the wrong thing to depend on when a route
 * misbehaves in production.
 *
 * <p>Actions, matching the original contract exactly:
 * <pre>
 *   resolve    -> { challenge_id, challenge_name }   host to challenge   (public)
 *   map        -> { map }                            challenge to host   (public)
 *   list       -> { domains: [] }                    every record        (admin)
 *   challenges -> { challenges: [] }                 picker options      (admin)
 * </pre>
 */
@RestController
public class ChallengeDomainController {

  private static final Logger log = LoggerFactory.getLogger(ChallengeDomainController.class);

  /**
   * Statuses that mean the hostname actually serves traffic. A record is
   * legitimately live under several of them — SSL can still be pending while
   * the site is already answering — so this cannot be narrowed to 'active'
   * without silently breaking domains mid-provisioning.
   */
  private static final Set<String> LIVE =
      Set.of("active", "deployed", "ssl_pending", "dns_pending");

  /**
   * 'resolve' and 'map' must stay public. Every visitor arriving at
   * voice.53challenges.com is anonymous and the page cannot render until the
   * host maps to a challenge. Neither reveals anything the hostname does not
   * already: these are publicly reachable addresses.
   */
  private static final Set<String> PUBLIC_ACTIONS = Set.of("resolve", "map");

  private final ChallengeDomainRepository repository;
  private final ChallengeApiClient challengeApi;
  private final CallerResolver caller;

  public ChallengeDomainController(
      ChallengeDomainRepository repository,
      ChallengeApiClient challengeApi,
      CallerResolver caller) {
    this.repository = repository;
    this.challengeApi = challengeApi;
    this.caller = caller;
  }

  @PostMapping("/api/apps/{appId}/functions/challengeDomains")
  public ResponseEntity<?> handle(@RequestBody(required = false) Map<String, Object> body) {
    Map<String, Object> request = body == null ? Map.of() : body;
    String action = String.valueOf(request.getOrDefault("action", ""));

    try {
      if ("resolve".equals(action)) {
        return ResponseEntity.ok(resolve(str(request.get("host"))));
      }
      if ("map".equals(action)) {
        return ResponseEntity.ok(Map.of("map", buildMap()));
      }

      if (!PUBLIC_ACTIONS.contains(action)
          && !caller.isAdmin(str(request.get("session_token")))) {
        return ResponseEntity.status(403).body(Map.of("error", "Admins only"));
      }

      if ("list".equals(action)) {
        return ResponseEntity.ok(
            Map.of("domains", repository.findAllByOrderByCreatedDateDesc()));
      }
      if ("challenges".equals(action)) {
        return ResponseEntity.ok(Map.of("challenges", challengeApi.activeChallenges(500)));
      }

      return ResponseEntity.badRequest().body(Map.of("error", "Unknown action"));
    } catch (Exception e) {
      log.error("challengeDomains action '{}' failed", action, e);
      return ResponseEntity.status(500).body(Map.of("error", e.getMessage()));
    }
  }

  private Map<String, Object> resolve(String rawHost) {
    // Trailing dot: a fully-qualified name is legal in a Host header and would
    // otherwise never match the stored value.
    String host = rawHost.trim().toLowerCase().replaceAll("\\.$", "");

    Map<String, Object> answer = new HashMap<>();
    answer.put("challenge_id", null);
    answer.put("challenge_name", "");
    if (host.isEmpty()) {
      return answer;
    }

    for (ChallengeDomainEntity row : repository.findByHost(host)) {
      if (LIVE.contains(nullToEmpty(row.getStatus()))) {
        answer.put("challenge_id", emptyToNull(row.getChallengeId()));
        answer.put("challenge_name", nullToEmpty(row.getChallengeName()));
        break;
      }
    }
    return answer;
  }

  /**
   * challenge_id to hostname, the reverse of resolve, so the main site can send
   * a visitor straight to a challenge's own domain instead of routing to
   * /challenges/&lt;id&gt; in place.
   */
  private Map<String, String> buildMap() {
    Map<String, String> map = new LinkedHashMap<>();
    List<ChallengeDomainEntity> rows = repository.findAllByOrderByCreatedDateDesc();
    for (ChallengeDomainEntity row : rows) {
      String cid = nullToEmpty(row.getChallengeId());
      String host = nullToEmpty(row.getFullDomain()).trim().toLowerCase();
      if (cid.isEmpty() || host.isEmpty()) {
        continue;
      }
      if (!LIVE.contains(nullToEmpty(row.getStatus()))) {
        continue;
      }
      // Rows are newest-first, so the first live row for a challenge wins.
      map.putIfAbsent(cid, host);
    }
    return map;
  }

  private static String str(Object v) {
    return v == null ? "" : String.valueOf(v);
  }

  private static String nullToEmpty(String v) {
    return v == null ? "" : v;
  }

  private static String emptyToNull(String v) {
    return v == null || v.isEmpty() ? null : v;
  }
}
