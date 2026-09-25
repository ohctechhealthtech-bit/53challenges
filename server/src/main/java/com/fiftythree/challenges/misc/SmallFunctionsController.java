package com.fiftythree.challenges.misc;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fiftythree.challenges.security.CustomSessionVerifier;
import com.fiftythree.challenges.user.UserRepository;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.CompletableFuture;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/**
 * Four small Base44 functions that share no state and warrant no class each:
 * {@code sessionRole}, {@code exclusionGuard}, {@code whatsMyIp},
 * {@code hostServices} and {@code hostPackages}.
 *
 * <p>Each keeps its own URL so nginx can cut them over one at a time, exactly
 * as with the larger ones.
 */
@RestController
public class SmallFunctionsController {

  private static final Logger log = LoggerFactory.getLogger(SmallFunctionsController.class);

  private static final Set<String> HOST_SERVICE_ACTIONS = Set.of("list", "get");

  private final HttpClient http =
      HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();

  private final CustomSessionVerifier customSession;
  private final UserRepository users;
  private final ObjectMapper mapper;
  private final String upstreamBase;
  private final String apiKey;
  private final HostPackagesService hostPackagesService;

  public SmallFunctionsController(
      CustomSessionVerifier customSession,
      UserRepository users,
      ObjectMapper mapper,
      @Value("${app.upstream.base-url}") String upstreamBase,
      @Value("${app.upstream.api-key}") String apiKey,
      HostPackagesService hostPackagesService) {
    this.customSession = customSession;
    this.users = users;
    this.mapper = mapper;
    this.upstreamBase = upstreamBase;
    this.apiKey = apiKey;
    this.hostPackagesService = hostPackagesService;
  }

  // ---------------------------------------------------------------- sessionRole

  /**
   * The app's own role for a Challenge-API login.
   *
   * <p>Custom logins carry whatever the upstream API returns, which knows
   * nothing of this app's admin role — so admin screens used to lock out people
   * who are admins here. The token is verified server-side and the role read
   * from the local User record.
   */
  @PostMapping("/api/apps/{appId}/functions/sessionRole")
  public ResponseEntity<?> sessionRole(@RequestBody(required = false) Map<String, Object> body) {
    try {
      Map<String, Object> request = body == null ? Map.of() : body;
      CustomSessionVerifier.Session session =
          customSession.verify(str(request.get("session_token")));
      if (session == null) {
        return ResponseEntity.status(401).body(Map.of("error", "Invalid session"));
      }
      String role = users.findRoleByEmail(session.email()).orElse("user");
      return ResponseEntity.ok(Map.of("email", session.email(), "role", role));
    } catch (Exception e) {
      log.error("sessionRole failed", e);
      return ResponseEntity.status(500).body(Map.of("error", e.getMessage()));
    }
  }

  // ------------------------------------------------------------- exclusionGuard

  /**
   * Whether an email is barred from entering this season.
   *
   * <p>No exclusion source exists yet, so everyone is eligible — the original
   * was a placeholder too. It is kept rather than dropped because the entry
   * flow calls it, and a 404 here would block entries outright.
   */
  @PostMapping("/api/apps/{appId}/functions/exclusionGuard")
  public ResponseEntity<?> exclusionGuard(@RequestBody(required = false) Map<String, Object> body) {
    Map<String, Object> request = body == null ? Map.of() : body;
    String email = str(request.get("email")).toLowerCase().trim();

    Map<String, Object> out = new LinkedHashMap<>();
    out.put("blocked", false);
    out.put("reason", null);
    if (!email.isEmpty()) {
      out.put("email", email);
    }
    return ResponseEntity.ok(out);
  }

  // ------------------------------------------------------------------ whatsMyIp

  /** The server's outbound IP, for whitelisting it with third parties. */
  @PostMapping("/api/apps/{appId}/functions/whatsMyIp")
  public ResponseEntity<?> whatsMyIp() {
    // Both are asked at once and neither is allowed to fail the response: this
    // is a diagnostic, and one provider being down should still leave the other
    // answer visible.
    CompletableFuture<String> icanhazip = getText("https://icanhazip.com/");
    CompletableFuture<String> ipinfo = getText("https://ipinfo.io/json");

    Map<String, Object> out = new LinkedHashMap<>();
    String plain = icanhazip.join();
    out.put("icanhazip", plain == null ? null : plain.trim());

    String info = ipinfo.join();
    JsonNode parsed = null;
    if (info != null) {
      try {
        parsed = mapper.readTree(info);
      } catch (Exception e) {
        log.warn("ipinfo returned non-JSON: {}", e.toString());
      }
    }
    out.put("ipinfo", parsed);
    return ResponseEntity.ok(out);
  }

  private CompletableFuture<String> getText(String url) {
    HttpRequest request = HttpRequest.newBuilder(URI.create(url))
        .timeout(Duration.ofSeconds(8))
        .GET()
        .build();
    return http.sendAsync(request, HttpResponse.BodyHandlers.ofString())
        .thenApply(HttpResponse::body)
        .exceptionally(e -> null);
  }

  // --------------------------------------------------------------- hostServices

  /**
   * Read-only proxy for the parent app's {@code hostServicesApi}.
   *
   * <p>Only list and get are forwarded, and the API key never reaches the
   * browser — that is the entire reason this indirection exists.
   */
  @PostMapping("/api/apps/{appId}/functions/hostServices")
  public ResponseEntity<?> hostServices(@RequestBody(required = false) Map<String, Object> body) {
    Map<String, Object> request = body == null ? Map.of() : body;
    String action = str(request.get("action"));
    if (action.isEmpty()) {
      action = "list";
    }
    if (!HOST_SERVICE_ACTIONS.contains(action)) {
      return ResponseEntity.badRequest().body(Map.of("error", "Unsupported action: " + action));
    }

    Map<String, Object> payload = new LinkedHashMap<>();
    payload.put("action", action);
    payload.put("api_key", apiKey);
    putIfPresent(payload, "key", str(request.get("key")));
    putIfPresent(payload, "id", str(request.get("id")));
    if (Boolean.TRUE.equals(request.get("include_inactive"))) {
      payload.put("include_inactive", true);
    }

    return proxy(siblingFunction("hostServicesApi"), payload);
  }

  // --------------------------------------------------------------- hostPackages

  /** Hosting packages, normalised for the pricing page. */
  @PostMapping("/api/apps/{appId}/functions/hostPackages")
  public ResponseEntity<?> hostPackages() {
    try {
      List<Map<String, Object>> packages = hostPackagesService.activePackages();
      return ResponseEntity.ok(Map.of("count", packages.size(), "packages", packages));
    } catch (HostPackagesService.PackagesUnavailableException e) {
      return ResponseEntity.status(502).body(Map.of("error", e.getMessage()));
    }
  }

  // ----------------------------------------------------------------- plumbing

  /**
   * A sibling function on the parent app, derived from the configured base URL
   * by swapping the trailing function name — the same trick
   * challengeApiHelper.ts used, so one setting still points at everything.
   */
  private String siblingFunction(String name) {
    return upstreamBase.replaceAll("/[^/]*$", "/" + name);
  }

  /** Forwards a payload upstream and returns its response body and status verbatim. */
  private ResponseEntity<?> proxy(String url, Map<String, Object> payload) {
    try {
      HttpRequest request = HttpRequest.newBuilder(URI.create(url))
          .timeout(Duration.ofSeconds(20))
          .header("Content-Type", "application/json")
          .header("x-api-key", apiKey)
          .POST(HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(payload)))
          .build();

      HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString());
      return ResponseEntity.status(response.statusCode())
          .contentType(MediaType.APPLICATION_JSON)
          .body(response.body());
    } catch (Exception e) {
      log.error("Upstream proxy to {} failed", url, e);
      return ResponseEntity.status(500).body(Map.of("error", e.getMessage()));
    }
  }

  private static void putIfPresent(Map<String, Object> map, String key, String value) {
    if (value != null && !value.isEmpty()) {
      map.put(key, value);
    }
  }

  private static String str(Object v) {
    return v == null ? "" : String.valueOf(v);
  }
}
