package com.fiftythree.challenges.upstream;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.fiftythree.challenges.compliance.ComplianceAuditService;
import com.fiftythree.challenges.lifecycle.LifecycleGateService;
import com.fiftythree.challenges.security.CustomSessionVerifier;
import com.fiftythree.challenges.security.JwtService;
import com.fiftythree.challenges.upstream.ChallengeApiClient.UpstreamResponse;
import com.fiftythree.challenges.support.ApiErrors;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/**
 * The Java replacement for {@code challengeApi}: the public proxy to the
 * upstream Challenge API.
 *
 * <p>This is the busiest function in the app and it carries the login path, so
 * three things are done here rather than trusted to the caller:
 *
 * <ul>
 *   <li><b>Draft, archived and deleted challenges are filtered out.</b> The
 *       upstream keyed endpoint returns them; anonymous visitors must not see
 *       them. Filtered twice — before the call by forcing status, and after it
 *       on the response.
 *   <li><b>Gated writes are refused before being forwarded.</b> Even a caller
 *       bypassing the UI cannot push an entry or vote into a challenge that is
 *       blocked pending legal review.
 *   <li><b>A successful login is given a server-signed session token</b>, so
 *       backend functions derive identity from a signature rather than from
 *       whatever the client claims.
 * </ul>
 */
@RestController
public class ChallengeApiController {

  private static final Logger log = LoggerFactory.getLogger(ChallengeApiController.class);

  private static final Set<String> GET_ACTIONS =
      Set.of("challenges", "entries", "votes", "classes");

  private static final List<String> GET_PARAMS = List.of(
      "id", "challenge_id", "status", "limit", "category", "division", "state",
      "phase", "sort", "page", "offset", "include_inactive", "user_email",
      "featured", "stage", "season");

  /**
   * Writes that must pass the compliance gate first.
   *
   * <p>publish_challenge and update_challenge are listed defensively — the
   * frontend does not use them today, but if they ever appear they are gated
   * rather than newly unguarded.
   */
  private static final Set<String> GATED_WRITE_ACTIONS =
      Set.of("submit_entry", "cast_vote", "publish_challenge", "update_challenge");

  /** Never visible to an anonymous caller. */
  private static final Set<String> BLOCKED_STATUSES = Set.of("draft", "archived", "deleted");

  /** Our action names mapped onto the parent's forgotPassword contract. */
  private static final Map<String, String> RESET_ACTIONS = Map.of(
      "forgot_password", "request",
      "verify_reset", "verify",
      "reset_password", "reset");

  /** How many upstream entry counts to fetch at once for the totals view. */
  private static final int TOTALS_BATCH = 6;

  private final HttpClient http =
      HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();

  private final ChallengeApiClient upstream;
  private final LifecycleGateService gates;
  private final ComplianceAuditService audit;
  private final CustomSessionVerifier sessions;
  private final JwtService jwt;
  private final ObjectMapper mapper;
  private final String googleClientId;

  public ChallengeApiController(
      ChallengeApiClient upstream,
      LifecycleGateService gates,
      ComplianceAuditService audit,
      CustomSessionVerifier sessions,
      JwtService jwt,
      ObjectMapper mapper,
      @Value("${app.google.client-id:}") String googleClientId) {
    this.upstream = upstream;
    this.gates = gates;
    this.audit = audit;
    this.sessions = sessions;
    this.jwt = jwt;
    this.mapper = mapper;
    this.googleClientId = googleClientId;
  }

  @PostMapping("/api/apps/{appId}/functions/challengeApi")
  public ResponseEntity<?> handle(@RequestBody(required = false) Map<String, Object> body) {
    Map<String, Object> request = body == null ? Map.of() : body;
    String action = str(request.get("action"));
    if (action.isEmpty()) {
      return ResponseEntity.badRequest().body(Map.of("error", "Missing action"));
    }

    try {
      if ("categories".equals(action)) {
        return categories(request);
      }
      if ("entry_totals".equals(action)) {
        return entryTotals();
      }
      if ("exchange_token".equals(action)) {
        return exchangeToken(request);
      }
      if (RESET_ACTIONS.containsKey(action)) {
        return passwordReset(action, request);
      }
      if (GET_ACTIONS.contains(action)) {
        return read(action, request);
      }
      return write(action, request);
    } catch (Exception e) {
      log.error("challengeApi action '{}' failed", action, e);
      return ApiErrors.internal(e);
    }
  }

  // ───────────────────────────────── reads ─────────────────────────────────

  private ResponseEntity<?> read(String action, Map<String, Object> request) {
    Map<String, String> params = new LinkedHashMap<>();
    for (String key : GET_PARAMS) {
      String value = str(request.get(key));
      if (!value.isEmpty()) {
        params.put(key, value);
      }
    }

    if ("challenges".equals(action)) {
      // Forced before the call: the upstream then filters, which protects even
      // if the response-side filter below ever fails to run. A caller cannot
      // ask for drafts by passing status=draft, and include_inactive is
      // stripped so inactive challenges never leak through the public proxy —
      // admins use challengeEngine for that.
      String status = params.getOrDefault("status", "").toLowerCase().trim();
      if (status.isEmpty() || BLOCKED_STATUSES.contains(status)) {
        params.put("status", "active");
      }
      params.remove("include_inactive");
    }

    if ("entries".equals(action)) {
      // A draft challenge's entries must not be exposed either, so the parent
      // challenge's own status is checked first.
      String cid = firstNonBlank(str(request.get("challenge_id")), str(request.get("id")));
      if (!cid.isEmpty() && !isPubliclyVisible(cid)) {
        return ResponseEntity.ok(Map.of("entries", List.of(), "count", 0));
      }
    }

    UpstreamResponse res =
        upstream.getFrom(upstream.sibling("publicChallengeApi"), action, params);

    if ("challenges".equals(action) && res.status() / 100 == 2) {
      return ResponseEntity.ok(filterChallenges(res.body()));
    }
    return ResponseEntity.status(res.status()).body(res.body());
  }

  /** Whether a challenge may be shown to an anonymous caller. */
  private boolean isPubliclyVisible(String challengeId) {
    UpstreamResponse res = upstream.getFrom(upstream.sibling("publicChallengeApi"),
        "challenges", Map.of("id", challengeId));
    JsonNode challenge = res.body().path("challenges").isArray()
        && res.body().path("challenges").size() > 0
        ? res.body().path("challenges").get(0)
        : res.body().path("challenge");
    if (challenge.isMissingNode() || challenge.isNull()) {
      // Unknown upstream: let the entries call answer for itself rather than
      // hiding a challenge this proxy simply could not look up.
      return true;
    }
    return isPublicStatus(challenge);
  }

  /** Removes non-public challenges from a response and corrects the count. */
  private JsonNode filterChallenges(JsonNode body) {
    if (!(body instanceof ObjectNode parsed)) {
      return body;
    }
    if (parsed.path("challenges").isArray()) {
      var kept = mapper.createArrayNode();
      for (JsonNode c : parsed.path("challenges")) {
        if (isPublicStatus(c)) {
          kept.add(c);
        }
      }
      parsed.set("challenges", kept);
      if (parsed.has("count")) {
        parsed.put("count", kept.size());
      }
      return parsed;
    }
    if (parsed.path("challenge").isObject() && !isPublicStatus(parsed.path("challenge"))) {
      ObjectNode empty = mapper.createObjectNode();
      empty.set("challenges", mapper.createArrayNode());
      empty.put("count", 0);
      return empty;
    }
    return parsed;
  }

  private static boolean isPublicStatus(JsonNode challenge) {
    return !BLOCKED_STATUSES.contains(
        challenge.path("status").asText("").toLowerCase().trim());
  }

  // ──────────────────────────────── writes ─────────────────────────────────

  private ResponseEntity<?> write(String action, Map<String, Object> request) {
    if (GATED_WRITE_ACTIONS.contains(action)) {
      String challengeId = challengeIdFrom(request);
      if (!challengeId.isEmpty()) {
        boolean blocked = "cast_vote".equals(action)
            ? gates.isVoteBlocked(challengeId)
            : gates.isEntryBlocked(challengeId);
        if (blocked) {
          // Refused here, before anything reaches upstream: this proxy is the
          // containment layer when a client bypasses the UI.
          audit.gateLog("", challengeId, "enforcement_block", action,
              "challengeApi proxy blocked a '" + action + "' for a launch-blocked challenge.");
          return ResponseEntity.status(403).body(Map.of(
              "error", "This challenge is temporarily blocked pending legal/compliance review."));
        }
      }
    }

    if ("google_login".equals(action) && !str(request.get("access_token")).isEmpty()) {
      return googleLogin(str(request.get("access_token")));
    }

    Map<String, Object> payload = new LinkedHashMap<>(request);
    UpstreamResponse res = upstream.postTo(upstream.sibling("publicChallengeApi"), payload);

    if ("login".equals(action) && res.status() / 100 == 2) {
      return ResponseEntity.ok(attachSessionToken(res.body()));
    }
    if ("google_config".equals(action) && !googleClientId.isBlank()
        && res.body() instanceof ObjectNode config) {
      config.put("clientId", googleClientId);
      return ResponseEntity.status(res.status()).body(config);
    }
    return ResponseEntity.status(res.status()).body(res.body());
  }

  /**
   * Signs in with Google, validating the token against Google directly.
   *
   * <p>Deliberately not forwarded to the upstream google_login, which checks
   * the token against a different, hardcoded client id and therefore rejects
   * tokens issued for this app.
   */
  private ResponseEntity<?> googleLogin(String accessToken) {
    try {
      HttpRequest req = HttpRequest.newBuilder(
              URI.create("https://www.googleapis.com/oauth2/v3/userinfo"))
          .timeout(Duration.ofSeconds(20))
          .header("Authorization", "Bearer " + accessToken)
          .GET()
          .build();
      HttpResponse<String> response = http.send(req, HttpResponse.BodyHandlers.ofString());
      if (response.statusCode() / 100 != 2) {
        return ResponseEntity.status(401)
            .body(Map.of("success", false, "error", "Invalid Google login token"));
      }

      JsonNode profile = mapper.readTree(response.body());
      String email = profile.path("email").asText("");
      if (email.isEmpty()) {
        return ResponseEntity.badRequest()
            .body(Map.of("success", false, "error", "Google account has no email"));
      }

      String name = firstNonBlank(
          profile.path("name").asText(""),
          profile.path("given_name").asText(""),
          email.substring(0, email.indexOf('@')));
      String uid = profile.path("sub").asText("");

      Map<String, Object> user = new LinkedHashMap<>();
      user.put("id", uid);
      user.put("email", email);
      user.put("full_name", name);
      user.put("role", "user");

      return ResponseEntity.ok(Map.of(
          "success", true,
          "user", user,
          // Server-signed proof of identity: backend functions verify this
          // rather than trusting an email in a request body.
          "session_token", sessions.sign(email, name, uid),
          "access_token", jwt.issue(email, name, uid)));
    } catch (Exception e) {
      log.error("Google login failed", e);
      return ResponseEntity.status(500)
          .body(Map.of("success", false, "error", "Google login failed: " + e.getMessage()));
    }
  }


  /**
   * Trades a valid session token for a JWT.
   *
   * <p>Only needed by browsers that signed in before login began issuing both
   * credentials. Without it those users would appear anonymous to the entity
   * API — their data silently missing — until the session expired and they
   * signed in again.
   *
   * <p>This grants nothing new: the session token is already server-signed
   * proof of the same identity, and an invalid one is refused outright.
   */
  private ResponseEntity<?> exchangeToken(Map<String, Object> request) {
    CustomSessionVerifier.Session session =
        sessions.verify(str(request.get("session_token")));
    if (session == null) {
      return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
    }
    return ResponseEntity.ok(Map.of(
        "success", true,
        "access_token", jwt.issue(session.email(), session.name(), session.uid())));
  }
  /** Attaches both credentials — session token and JWT — to a successful login. */
  private JsonNode attachSessionToken(JsonNode body) {
    if (!(body instanceof ObjectNode parsed)) {
      return body;
    }
    String email = parsed.path("user").path("email").asText("");
    if (!parsed.path("success").asBoolean(false) || email.isEmpty()) {
      return parsed;
    }
    String name = parsed.path("user").path("full_name").asText("");
    String uid = parsed.path("user").path("id").asText("");
    parsed.put("session_token", sessions.sign(email, name, uid));
    // The same identity as a JWT, which is what the entity API reads. The SDK
    // sends it as a bearer header, where a body field cannot reach; the
    // session token stays because every ported function still expects it.
    parsed.put("access_token", jwt.issue(email, name, uid));
    return parsed;
  }

  // ───────────────────────────── other actions ─────────────────────────────

  /**
   * The category list.
   *
   * <p>Upstream has no categories endpoint yet, so the list is derived from
   * live challenge data — real categories rather than a hardcoded list. The
   * upstream endpoint is tried first, so this starts using it automatically
   * once it exists.
   */
  private ResponseEntity<?> categories(Map<String, Object> request) {
    Map<String, String> params = new LinkedHashMap<>();
    if (truthy(request.get("include_inactive"))) {
      params.put("include_inactive", "true");
    }
    UpstreamResponse direct =
        upstream.getFrom(upstream.sibling("publicChallengeApi"), "categories", params);
    if (direct.status() / 100 == 2 && direct.body().path("categories").isArray()) {
      return ResponseEntity.ok(direct.body());
    }

    Map<String, String[]> seen = new LinkedHashMap<>();
    for (JsonNode c : upstream.challenges(Map.of("limit", "500"))) {
      String raw = c.path("category").asText("").trim();
      if (raw.isEmpty()) {
        continue;
      }
      String normalised = raw.toLowerCase().replace('_', '-');
      seen.putIfAbsent(normalised, new String[] {raw, c.path("cover_image").asText("")});
    }

    List<Map<String, Object>> categories = new ArrayList<>();
    int order = 0;
    for (Map.Entry<String, String[]> e : seen.entrySet()) {
      Map<String, Object> row = new LinkedHashMap<>();
      row.put("key", e.getKey().replace('-', '_'));
      row.put("label", titleCase(e.getValue()[0].replace('_', ' ')));
      row.put("description", "");
      row.put("image_url", e.getValue()[1]);
      row.put("sort_order", order++);
      row.put("is_active", true);
      categories.add(row);
    }
    return ResponseEntity.ok(Map.of("categories", categories, "count", categories.size()));
  }

  /**
   * Dashboard totals.
   *
   * <p>One request here instead of one per challenge from the browser, which
   * used to trip the platform rate limit. The upstream calls still happen, but
   * batched and server-side.
   */
  private ResponseEntity<?> entryTotals() {
    List<JsonNode> challenges = upstream.challenges(Map.of("limit", "500"));
    int entries = 0;
    for (int i = 0; i < challenges.size(); i += TOTALS_BATCH) {
      for (JsonNode c : challenges.subList(i, Math.min(i + TOTALS_BATCH, challenges.size()))) {
        entries += upstream.entries(c.path("id").asText(""), 500).size();
      }
    }
    return ResponseEntity.ok(Map.of("challenges", challenges.size(), "entries", entries));
  }

  /**
   * Password reset, which lives on a sibling function rather than as an action.
   *
   * <p>No API key is sent: the parent's forgotPassword is a public endpoint,
   * and forwarding the key would widen where it travels for no benefit.
   */
  private ResponseEntity<?> passwordReset(String action, Map<String, Object> request) {
    Map<String, Object> payload = new LinkedHashMap<>();
    payload.put("action", RESET_ACTIONS.get(action));
    if ("forgot_password".equals(action)) {
      payload.put("email", str(request.get("email")));
    }
    if ("verify_reset".equals(action)) {
      payload.put("token", str(request.get("token")));
    }
    if ("reset_password".equals(action)) {
      payload.put("token", str(request.get("token")));
      payload.put("newPassword", firstNonBlank(
          str(request.get("new_password")), str(request.get("newPassword"))));
    }
    UpstreamResponse res = upstream.postTo(upstream.sibling("forgotPassword"), payload);
    return ResponseEntity.status(res.status()).body(res.body());
  }

  // ─────────────────────────────── plumbing ────────────────────────────────

  /** The challenge a gated write refers to, wherever the caller put it. */
  private static String challengeIdFrom(Map<String, Object> request) {
    String direct = str(request.get("challenge_id"));
    if (!direct.isEmpty()) {
      return direct;
    }
    if (request.get("entry") instanceof Map<?, ?> entry) {
      return str(entry.get("challenge_id"));
    }
    return "";
  }

  private static String titleCase(String value) {
    StringBuilder out = new StringBuilder(value.length());
    boolean atWordStart = true;
    for (char c : value.toCharArray()) {
      out.append(atWordStart ? Character.toUpperCase(c) : c);
      atWordStart = !Character.isLetterOrDigit(c);
    }
    return out.toString();
  }

  private static boolean truthy(Object v) {
    return Boolean.TRUE.equals(v) || "true".equalsIgnoreCase(String.valueOf(v));
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
