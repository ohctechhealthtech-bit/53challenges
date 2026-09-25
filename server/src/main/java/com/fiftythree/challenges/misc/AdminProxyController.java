package com.fiftythree.challenges.misc;

import com.fiftythree.challenges.security.CallerResolver;
import com.fiftythree.challenges.upstream.ChallengeApiClient;
import com.fiftythree.challenges.upstream.ChallengeApiClient.UpstreamResponse;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/**
 * Admin-only proxies to the parent app: {@code adminChallenge} and
 * {@code hostRequestQuote}.
 *
 * <p>Both exist for one reason — the API key must never reach a browser. The
 * admin check happens here, before anything is forwarded, so an unauthenticated
 * caller cannot use this app as an open relay to the parent's admin API.
 */
@RestController
public class AdminProxyController {

  private final ChallengeApiClient upstream;
  private final CallerResolver caller;

  public AdminProxyController(ChallengeApiClient upstream, CallerResolver caller) {
    this.upstream = upstream;
    this.caller = caller;
  }

  @PostMapping("/api/apps/{appId}/functions/adminChallenge")
  public ResponseEntity<?> adminChallenge(@RequestBody(required = false) Map<String, Object> body) {
    Map<String, Object> request = body == null ? Map.of() : body;
    ResponseEntity<?> denied = requireAdmin(request);
    if (denied != null) {
      return denied;
    }

    String action = str(request.get("action"));
    if (action.isEmpty()) {
      return error(400, "missing_action", "Missing action");
    }

    Map<String, Object> payload = new LinkedHashMap<>();
    payload.put("action", action);
    payload.put("params", request.get("params") == null ? Map.of() : request.get("params"));

    UpstreamResponse res = upstream.postTo(upstream.sibling("adminChallengeApi"), payload);

    // The parent reports failure in the body as ok:false while still answering
    // 200, so the status is taken from the payload when it disagrees.
    int status = res.body().path("ok").isBoolean() && !res.body().path("ok").asBoolean()
        ? (res.status() >= 400 ? res.status() : 400)
        : 200;
    return ResponseEntity.status(status).body(res.body());
  }

  @PostMapping("/api/apps/{appId}/functions/hostRequestQuote")
  public ResponseEntity<?> hostRequestQuote(@RequestBody(required = false) Map<String, Object> body) {
    Map<String, Object> request = body == null ? Map.of() : body;
    ResponseEntity<?> denied = requireAdmin(request);
    if (denied != null) {
      return denied;
    }

    String action = str(request.get("action"));
    if (action.isEmpty()) {
      return error(400, "missing_action", "Missing action");
    }

    // The parent handles Stripe payment links and applicant emails itself, so
    // the session token is forwarded — it identifies the admin who issued the
    // quote on the parent's side too.
    Map<String, Object> payload = new LinkedHashMap<>();
    payload.put("action", action);
    payload.put("session_token", str(request.get("session_token")));
    payload.put("request_id", request.get("request_id"));
    payload.put("amount", request.get("amount"));
    payload.put("notes", request.get("notes"));

    UpstreamResponse res = upstream.postTo(upstream.sibling("hostRequestQuote"), payload);
    return ResponseEntity.status(res.status()).body(res.body());
  }

  /** Null when the caller is an admin, otherwise the 403 to return. */
  private ResponseEntity<?> requireAdmin(Map<String, Object> request) {
    if (caller.isAdmin(str(request.get("session_token")))) {
      return null;
    }
    return error(403, "forbidden", "Admins only");
  }

  private static ResponseEntity<?> error(int status, String code, String message) {
    return ResponseEntity.status(status)
        .body(Map.of("ok", false, "error", Map.of("code", code, "message", message)));
  }

  private static String str(Object v) {
    return v == null ? "" : String.valueOf(v);
  }
}
