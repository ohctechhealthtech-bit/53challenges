package com.fiftythree.challenges.plesk;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fiftythree.challenges.security.CallerResolver;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/**
 * The Java replacement for {@code pleskCreateKey}: mints a Plesk API key using
 * the panel admin credentials.
 *
 * <p><b>Admin-only, unlike the original.</b> The Base44 version took no request
 * object and performed no authentication whatsoever, while returning a freshly
 * created, unrestricted Plesk API key in its response body. Anyone who knew the
 * URL could have taken full API control of the hosting. That is not reproduced.
 *
 * <p><b>This is a bootstrap tool and nothing depends on it.</b> Plesk's own
 * interface creates keys in about thirty seconds (Tools &amp; Settings → API
 * Keys), and doing it there means {@code PLESK_ADMIN_PASSWORD} never has to
 * exist on this server at all. This endpoint is here because it was asked for;
 * if {@code PLESK_ADMIN_PASSWORD} is unset it simply says so, which is the
 * recommended state.
 *
 * <p>The created key <b>is</b> returned, once, because there is no other way to
 * receive it — Plesk does not show it again. It is never logged.
 */
@RestController
public class PleskCreateKeyController {

  private static final Logger log = LoggerFactory.getLogger(PleskCreateKeyController.class);

  private final HttpClient http = HttpClient.newBuilder()
      .connectTimeout(Duration.ofSeconds(10))
      .build();

  private final PleskClient plesk;
  private final CallerResolver caller;
  private final ObjectMapper mapper;
  private final String adminPassword;

  public PleskCreateKeyController(
      PleskClient plesk,
      CallerResolver caller,
      ObjectMapper mapper,
      @Value("${app.plesk.admin-password:}") String adminPassword) {
    this.plesk = plesk;
    this.caller = caller;
    this.mapper = mapper;
    this.adminPassword = adminPassword == null ? "" : adminPassword.trim();
  }

  @PostMapping("/api/apps/{appId}/functions/pleskCreateKey")
  public ResponseEntity<?> handle(@RequestBody(required = false) Map<String, Object> body) {
    Map<String, Object> request = body == null ? Map.of() : body;
    String sessionToken = str(request.get("session_token"));
    if (caller.email(sessionToken) == null) {
      return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
    }
    if (!caller.isAdmin(sessionToken)) {
      return ResponseEntity.status(403).body(Map.of("error", "Admin only"));
    }

    if (plesk.baseUrl().isEmpty()) {
      return ResponseEntity.status(500).body(Map.of("error", "PLESK_BASE_URL is not set"));
    }
    if (adminPassword.isEmpty()) {
      return ResponseEntity.status(500).body(Map.of("error",
          "PLESK_ADMIN_PASSWORD is not set. This is the recommended state — create "
              + "the key in Plesk under Tools & Settings → API Keys instead, so the "
              + "panel admin password never has to be stored on this server."));
    }

    String credentials = Base64.getEncoder().encodeToString(
        (plesk.adminUser() + ":" + adminPassword).getBytes(StandardCharsets.UTF_8));

    try {
      HttpRequest apiRequest = HttpRequest.newBuilder(
              URI.create(plesk.baseUrl() + "/api/v2/auth/keys"))
          .timeout(Duration.ofSeconds(15))
          .header("Authorization", "Basic " + credentials)
          .header("Content-Type", "application/json")
          .header("Accept", "application/json")
          .POST(HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(Map.of(
              "login", plesk.adminUser(),
              "description", "53 Challenges backend (created from the admin console)"))))
          .build();

      HttpResponse<String> response =
          http.send(apiRequest, HttpResponse.BodyHandlers.ofString());

      JsonNode parsed;
      try {
        parsed = mapper.readTree(response.body());
      } catch (Exception e) {
        parsed = mapper.createObjectNode();
      }

      String key = parsed.path("key").asText("");
      if (response.statusCode() == 201 && !key.isBlank()) {
        Map<String, Object> out = new LinkedHashMap<>();
        // Returned once, because Plesk will not show it again. Never logged.
        out.put("success", true);
        out.put("key", key);
        out.put("message", "New API key created. Copy it into PLESK_API_KEY, run "
            + "daemon-reload and restart, then check pleskDiagnostic. "
            + "Remove PLESK_ADMIN_PASSWORD afterwards — nothing else needs it.");
        return ResponseEntity.ok(out);
      }

      log.warn("Plesk key creation returned HTTP {}", response.statusCode());
      Map<String, Object> out = new LinkedHashMap<>();
      out.put("error", "Plesk returned HTTP " + response.statusCode());
      // The body can name the reason — a wrong password, a licence limit —
      // without containing a key, since none was issued.
      out.put("detail", truncate(response.body()));
      return ResponseEntity.status(response.statusCode() >= 400
          ? response.statusCode() : 502).body(out);
    } catch (Exception e) {
      log.error("Could not reach Plesk to create an API key: {}", e.toString());
      return ResponseEntity.status(502).body(Map.of(
          "error", "Could not reach Plesk: " + e.getMessage()));
    }
  }

  private static String truncate(String body) {
    if (body == null) {
      return "";
    }
    String trimmed = body.trim();
    return trimmed.length() <= 300 ? trimmed : trimmed.substring(0, 300);
  }

  private static String str(Object value) {
    if (value == null) {
      return null;
    }
    String text = String.valueOf(value).trim();
    return text.isEmpty() ? null : text;
  }
}
