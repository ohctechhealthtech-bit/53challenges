package com.fiftythree.challenges.upstream;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fiftythree.challenges.support.ApiErrors;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Reads from the upstream Challenge API.
 *
 * <p>Ports the read half of {@code base44/shared/challengeApiHelper.ts}. The
 * upstream app is a separate Base44 application that this project does not own,
 * and it remains the source of truth for challenges: the local {@code challenge}
 * table holds template-generated records, while the real ones — "Photo of the
 * Day" and so on — only exist upstream. Migrating the database did not change
 * that, so the domain picker still asks upstream.
 *
 * <p>Actions in {@code GET_ACTIONS} are query-string GETs; everything else is a
 * JSON POST. That split is the upstream API's, not a choice made here.
 */
@Component
public class ChallengeApiClient {

  private static final Logger log = LoggerFactory.getLogger(ChallengeApiClient.class);

  private final HttpClient http =
      HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();
  private final ObjectMapper mapper = new ObjectMapper();
  private final String baseUrl;
  private final String apiKey;

  public ChallengeApiClient(
      @Value("${app.upstream.base-url}") String baseUrl,
      @Value("${app.upstream.api-key}") String apiKey) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
  }

  /**
   * Active challenges as {@code {id, title}} pairs for the admin picker.
   *
   * <p>Returns an empty list rather than throwing when upstream is unreachable:
   * the domain-management table must still render its existing rows when the
   * picker cannot be populated, which is what the Base44 version's
   * {@code .catch(() => null)} achieved.
   */
  public List<Map<String, String>> activeChallenges(int limit) {
    try {
      String url = baseUrl
          + "?action=challenges&status=active&limit="
          + URLEncoder.encode(String.valueOf(limit), StandardCharsets.UTF_8);

      HttpRequest request = HttpRequest.newBuilder(URI.create(url))
          .timeout(Duration.ofSeconds(20))
          .header("x-api-key", apiKey)
          .GET()
          .build();

      HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString());
      if (response.statusCode() / 100 != 2) {
        log.warn("Upstream challenges returned HTTP {}", response.statusCode());
        return List.of();
      }

      JsonNode json = mapper.readTree(response.body());
      // Upstream has returned the list under both keys; accept either rather
      // than silently producing an empty picker when it changes.
      JsonNode items = json.path("data");
      if (!items.isArray()) {
        items = json.path("challenges");
      }
      if (!items.isArray()) {
        log.warn("Upstream challenges response had neither 'data' nor 'challenges' array");
        return List.of();
      }

      List<Map<String, String>> out = new ArrayList<>();
      for (JsonNode c : items) {
        String id = c.path("id").asText("");
        if (id.isBlank()) {
          continue;
        }
        String title = c.path("title").asText("");
        if (title.isBlank()) {
          title = c.path("theme").asText("");
        }
        out.add(Map.of("id", id, "title", title.isBlank() ? id : title));
      }
      return out;
    } catch (Exception e) {
      log.warn("Upstream challenges fetch failed: {}", e.toString());
      return List.of();
    }
  }
/**
   * Raw `challenges` read, returning the list however upstream chose to wrap
   * it. Callers get the nodes untouched because challengeEngine passes whole
   * challenge records straight back to the client.
   *
   * <p>Upstream has returned this list bare, under {@code challenges}, under
   * {@code data}, and as a single {@code challenge} — so all four shapes are
   * accepted rather than assuming the one seen most recently.
   */
  public List<JsonNode> challenges(Map<String, String> params) {
    try {
      StringBuilder url = new StringBuilder(baseUrl).append("?action=challenges");
      for (Map.Entry<String, String> p : params.entrySet()) {
        url.append("&")
            .append(URLEncoder.encode(p.getKey(), StandardCharsets.UTF_8))
            .append("=")
            .append(URLEncoder.encode(p.getValue(), StandardCharsets.UTF_8));
      }

      HttpRequest request = HttpRequest.newBuilder(URI.create(url.toString()))
          .timeout(Duration.ofSeconds(20))
          .header("x-api-key", apiKey)
          .GET()
          .build();

      HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString());
      if (response.statusCode() / 100 != 2) {
        log.warn("Upstream challenges returned HTTP {}", response.statusCode());
        return List.of();
      }

      JsonNode json = mapper.readTree(response.body());
      JsonNode items = json.isArray() ? json : json.path("challenges");
      if (!items.isArray()) {
        items = json.path("data");
      }
      List<JsonNode> out = new ArrayList<>();
      if (items.isArray()) {
        for (JsonNode n : items) {
          out.add(n);
        }
      } else if (json.path("challenge").isObject()) {
        out.add(json.path("challenge"));
      }
      return out;
    } catch (Exception e) {
      log.warn("Upstream challenges fetch failed: {}", e.toString());
      return List.of();
    }
  }

  /**
   * Creates a challenge upstream. Returns the raw response so the caller can
   * report upstream's own rejection message rather than inventing one.
   */
  public JsonNode post(String action, Map<String, Object> payload) {
    try {
      Map<String, Object> body = new LinkedHashMap<>(payload);
      body.put("action", action);

      HttpRequest request = HttpRequest.newBuilder(URI.create(baseUrl))
          .timeout(Duration.ofSeconds(30))
          .header("Content-Type", "application/json")
          .header("x-api-key", apiKey)
          .POST(HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(body)))
          .build();

      HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString());
      return mapper.readTree(response.body());
    } catch (Exception e) {
      log.warn("Upstream {} failed: {}", action, e.toString());
      return mapper.createObjectNode().put("error", "Upstream request failed");
    }
  }
/** Entries for one challenge, as upstream returns them. */
  public List<JsonNode> entries(String challengeId, int limit) {
    try {
      String url = baseUrl
          + "?action=entries&challenge_id="
          + URLEncoder.encode(challengeId, StandardCharsets.UTF_8)
          + "&limit=" + limit;

      HttpRequest request = HttpRequest.newBuilder(URI.create(url))
          .timeout(Duration.ofSeconds(20))
          .header("x-api-key", apiKey)
          .GET()
          .build();

      HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString());
      if (response.statusCode() / 100 != 2) {
        return List.of();
      }
      JsonNode json = mapper.readTree(response.body());
      JsonNode items = json.isArray() ? json : json.path("entries");
      List<JsonNode> out = new ArrayList<>();
      if (items.isArray()) {
        for (JsonNode n : items) {
          out.add(n);
        }
      }
      return out;
    } catch (Exception e) {
      // One challenge failing must not empty the whole homepage feed.
      log.warn("Upstream entries for {} failed: {}", challengeId, e.toString());
      return List.of();
    }
  }
/**
   * A sibling function on the parent app, derived from the configured base URL
   * by replacing the trailing function name. One setting therefore points at
   * publicChallengeApi, adminChallengeApi, hostRequestQuote and the rest —
   * the same derivation challengeApiHelper.ts used.
   */
  public String sibling(String functionName) {
    return baseUrl.replaceAll("/[^/]*$", "/" + functionName);
  }

  /** POSTs JSON to any parent-app function and returns the parsed body and status. */
  public UpstreamResponse postTo(String url, Map<String, Object> payload) {
    try {
      HttpRequest request = HttpRequest.newBuilder(URI.create(url))
          .timeout(Duration.ofSeconds(30))
          .header("Content-Type", "application/json")
          .header("x-api-key", apiKey)
          .POST(HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(payload)))
          .build();

      HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString());
      try {
        return new UpstreamResponse(response.statusCode(), mapper.readTree(response.body()));
      } catch (Exception parse) {
        // A non-JSON body is upstream failing in a way worth reporting as
        // itself rather than as a generic error — an HTML error page here has
        // meant an expired key more than once.
        return new UpstreamResponse(response.statusCode(), mapper.createObjectNode()
            .put("ok", false)
            .put("error", "Parent returned non-JSON (HTTP " + response.statusCode() + ")"));
      }
    } catch (Exception e) {
      log.warn("Upstream POST to {} failed: {}", url, e.toString());
      return new UpstreamResponse(500, mapper.createObjectNode()
          .put("ok", false)
          .put("error", e.getMessage() == null ? "Upstream request failed" : e.getMessage()));
    }
  }

  public record UpstreamResponse(int status, JsonNode body) {}
/** GETs from a parent-app function with query parameters, returning body and status. */
  public UpstreamResponse getFrom(String url, String action, Map<String, String> params) {
    try {
      StringBuilder target = new StringBuilder(url)
          .append("?action=")
          .append(URLEncoder.encode(action, StandardCharsets.UTF_8));
      for (Map.Entry<String, String> p : params.entrySet()) {
        target.append("&")
            .append(URLEncoder.encode(p.getKey(), StandardCharsets.UTF_8))
            .append("=")
            .append(URLEncoder.encode(p.getValue(), StandardCharsets.UTF_8));
      }

      HttpRequest request = HttpRequest.newBuilder(URI.create(target.toString()))
          .timeout(Duration.ofSeconds(30))
          .header("x-api-key", apiKey)
          .GET()
          .build();

      HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString());
      try {
        return new UpstreamResponse(response.statusCode(), mapper.readTree(response.body()));
      } catch (Exception parse) {
        return new UpstreamResponse(response.statusCode(), mapper.createObjectNode()
            .put("error", "Parent returned non-JSON (HTTP " + response.statusCode() + ")"));
      }
    } catch (Exception e) {
      log.warn("Upstream GET {} failed: {}", action, e.toString());
      return new UpstreamResponse(500, mapper.createObjectNode()
          .put("error", e.getMessage() == null ? "Upstream request failed" : e.getMessage()));
    }
  }
}
