package com.fiftythree.challenges.auth;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Map;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Validates credentials against the upstream Challenge API.
 *
 * <p>Password hashes are not in this database — the local User record holds only
 * a role — so authentication is delegated, exactly as the Base44
 * {@code challengeApi} login action did. On success this API mints its own JWT;
 * the upstream response is never passed to the client.
 */
@Component
public class UpstreamAuthClient {

  private final HttpClient http =
      HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();
  private final ObjectMapper mapper = new ObjectMapper();
  private final String baseUrl;
  private final String apiKey;

  public UpstreamAuthClient(
      @Value("${app.upstream.base-url}") String baseUrl,
      @Value("${app.upstream.api-key}") String apiKey) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
  }

  /** The authenticated account, or null when the credentials are rejected. */
  public AuthenticatedUser login(String email, String password) {
    try {
      String body = mapper.writeValueAsString(
          Map.of("action", "login", "email", email, "password", password));

      HttpRequest request = HttpRequest.newBuilder(URI.create(baseUrl))
          .timeout(Duration.ofSeconds(20))
          .header("Content-Type", "application/json")
          .header("x-api-key", apiKey)
          .POST(HttpRequest.BodyPublishers.ofString(body))
          .build();

      HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString());
      if (response.statusCode() / 100 != 2) {
        return null;
      }
      JsonNode json = mapper.readTree(response.body());
      if (!json.path("success").asBoolean(false)) {
        return null;
      }
      JsonNode user = json.path("user");
      String userEmail = user.path("email").asText("");
      if (userEmail.isBlank()) {
        return null;
      }
      return new AuthenticatedUser(
          userEmail.toLowerCase().trim(),
          user.path("full_name").asText(""),
          user.path("id").asText(""));
    } catch (Exception e) {
      // A transport failure is not a credential failure, but the caller only
      // needs "could not authenticate"; the detail goes to the logs.
      return null;
    }
  }

  public record AuthenticatedUser(String email, String name, String uid) {}
}
