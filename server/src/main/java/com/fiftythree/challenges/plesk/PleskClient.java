package com.fiftythree.challenges.plesk;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Base64;
import java.util.List;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Talks to Plesk, replacing {@code base44/shared/pleskApi.ts}.
 *
 * <p>Two transports, because Plesk needs both. <b>REST API v2</b> covers
 * server info, domain listing and lookup. The <b>CLI gateway</b>
 * ({@code POST /api/v2/cli/{tool}/call}) covers the operations REST has no
 * equivalent for — creating a subdomain under an existing subscription,
 * certificates, site updates.
 *
 * <p><b>Credentials.</b> This authenticates with a scoped {@code PLESK_API_KEY}
 * and deliberately does <em>not</em> accept the panel admin password, which the
 * original helper allowed as an alternative. An application that provisions
 * subdomains has no need to hold the credential that can do everything else to
 * the server as well, and a scoped key can be revoked without changing the
 * admin login.
 *
 * <p>Nothing here throws on a Plesk failure. Every call returns a
 * {@link Result} carrying the error text, because these operations are chained
 * — create a subdomain, then upload, then configure a proxy — and a partial
 * failure needs reporting rather than unwinding through exceptions.
 */
@Component
public class PleskClient {

  private static final Logger log = LoggerFactory.getLogger(PleskClient.class);

  private static final Duration TIMEOUT = Duration.ofSeconds(30);

  private final HttpClient http = HttpClient.newBuilder()
      .connectTimeout(Duration.ofSeconds(10))
      .build();

  private final ObjectMapper mapper;
  private final String baseUrl;
  private final String baseDomain;
  private final String apiKey;
  private final String adminUser;
  private final String documentRoot;

  public PleskClient(
      ObjectMapper mapper,
      @Value("${app.plesk.base-url:}") String baseUrl,
      @Value("${app.plesk.base-domain:}") String baseDomain,
      @Value("${app.plesk.api-key:}") String apiKey,
      @Value("${app.plesk.admin-user:admin}") String adminUser,
      @Value("${app.plesk.document-root:}") String documentRoot) {
    this.mapper = mapper;
    // A trailing slash would produce "//api/v2" and Plesk answers 404 for it.
    this.baseUrl = trim(baseUrl).replaceAll("/+$", "");
    this.baseDomain = trim(baseDomain);
    this.apiKey = trim(apiKey);
    this.adminUser = trim(adminUser).isEmpty() ? "admin" : trim(adminUser);
    this.documentRoot = trim(documentRoot);
  }

  /** Whether enough is configured to reach Plesk at all. */
  public boolean isConfigured() {
    return !baseUrl.isEmpty() && !baseDomain.isEmpty() && !apiKey.isEmpty();
  }

  /** What is missing, for a diagnostic to report. */
  public String missingConfiguration() {
    if (isConfigured()) {
      return null;
    }
    return "Plesk not configured — need PLESK_BASE_URL, PLESK_BASE_DOMAIN "
        + "and PLESK_API_KEY.";
  }

  public String baseUrl() {
    return baseUrl;
  }

  public String baseDomain() {
    return baseDomain;
  }

  public String adminUser() {
    return adminUser;
  }

  public String documentRoot() {
    return documentRoot;
  }

  public boolean hasApiKey() {
    return !apiKey.isEmpty();
  }

  /** The outcome of one Plesk call: the parsed body, or why it failed. */
  public record Result(boolean ok, int status, JsonNode data, String error) {

    public static Result failed(String error) {
      return new Result(false, 0, null, error);
    }

    public JsonNode dataOrEmpty(ObjectMapper mapper) {
      return data == null ? mapper.createObjectNode() : data;
    }
  }

  /** The outcome of a CLI gateway call. */
  public record CliResult(boolean ok, int code, String stdout, String stderr, String error) {}

  // ---------------------------------------------------------------- REST

  public Result get(String path) {
    return request("GET", path, null);
  }

  public Result post(String path, Object body) {
    return request("POST", path, body);
  }

  public Result put(String path, Object body) {
    return request("PUT", path, body);
  }

  public Result delete(String path) {
    return request("DELETE", path, null);
  }

  private Result request(String method, String path, Object body) {
    if (!isConfigured()) {
      return Result.failed(missingConfiguration());
    }
    try {
      HttpRequest.Builder builder = HttpRequest.newBuilder(
              URI.create(baseUrl + "/api/v2" + path))
          .timeout(TIMEOUT)
          .header("Authorization", basicAuth())
          .header("Content-Type", "application/json")
          .header("Accept", "application/json");

      builder.method(method, body == null
          ? HttpRequest.BodyPublishers.noBody()
          : HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(body)));

      HttpResponse<String> response = http.send(builder.build(),
          HttpResponse.BodyHandlers.ofString());
      return interpret(response.statusCode(), response.body());
    } catch (Exception e) {
      log.warn("Plesk {} {} failed: {}", method, path, e.toString());
      return Result.failed("Could not reach Plesk: " + e.getMessage());
    }
  }

  /**
   * Turns an HTTP response into a result, naming the failures that have a
   * specific cause an operator can act on.
   */
  private Result interpret(int status, String body) {
    if (status == 401) {
      return new Result(false, 401, null, "Plesk rejected credentials (HTTP 401).");
    }
    if (status == 403) {
      // Plesk error 1003 is an API key restricted to particular source IPs.
      // Worth naming, because the fix is a setting in the panel rather than a
      // wrong key, and the generic 403 sends people checking the key instead.
      if (body != null && body.contains("1003")) {
        return new Result(false, 403, null,
            "Plesk API key IP restriction (error 1003). "
                + "Allow this server's IP in Plesk → API Keys.");
      }
      return new Result(false, 403, null, "Plesk HTTP 403");
    }

    JsonNode parsed = null;
    try {
      parsed = mapper.readTree(body);
    } catch (Exception e) {
      // A non-JSON body, which Plesk returns for some errors.
    }

    if (status >= 400) {
      String message = parsed == null ? truncate(body)
          : firstNonBlank(
              parsed.path("message").asText(""),
              parsed.path("error").path("message").asText(""),
              truncate(body));
      return new Result(false, status, parsed, "Plesk HTTP " + status + ": " + message);
    }
    return new Result(true, status, parsed, null);
  }

  // ----------------------------------------------------------------- CLI

  /**
   * Runs a Plesk CLI tool through the gateway.
   *
   * <p>The gateway answers 200 even when the command itself failed, so the
   * body's exit code is checked separately — treating HTTP 200 as success
   * here would report a failed subdomain creation as having worked.
   */
  public CliResult cli(String tool, List<String> params) {
    if (!isConfigured()) {
      return new CliResult(false, -1, "", "", missingConfiguration());
    }
    try {
      HttpRequest request = HttpRequest.newBuilder(
              URI.create(baseUrl + "/api/v2/cli/" + tool + "/call"))
          .timeout(TIMEOUT)
          .header("Authorization", basicAuth())
          .header("Content-Type", "application/json")
          .header("Accept", "application/json")
          .POST(HttpRequest.BodyPublishers.ofString(
              mapper.writeValueAsString(java.util.Map.of("params", params))))
          .build();

      HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString());
      if (response.statusCode() == 401) {
        return new CliResult(false, -1, "", "", "Plesk rejected credentials (HTTP 401).");
      }
      if (response.statusCode() == 403) {
        String message = response.body() != null && response.body().contains("1003")
            ? "Plesk API key IP restriction (error 1003)."
            : "Plesk HTTP 403";
        return new CliResult(false, -1, "", "", message);
      }
      if (response.statusCode() >= 400) {
        return new CliResult(false, -1, "", "",
            "Plesk CLI HTTP " + response.statusCode() + ": " + truncate(response.body()));
      }

      JsonNode body = mapper.readTree(response.body());
      int code = body.path("code").asInt(0);
      String stdout = body.path("stdout").asText("");
      String stderr = body.path("stderr").asText("");
      if (code != 0) {
        String detail = firstNonBlank(stderr.trim(), stdout.trim(),
            "Plesk CLI exited with code " + code);
        return new CliResult(false, code, stdout, stderr, detail);
      }
      return new CliResult(true, code, stdout, stderr, null);
    } catch (Exception e) {
      log.warn("Plesk CLI {} failed: {}", tool, e.toString());
      return new CliResult(false, -1, "", "", "Could not reach Plesk CLI: " + e.getMessage());
    }
  }

  // ------------------------------------------------------------ shortcuts

  public Result serverInfo() {
    return get("/server");
  }

  /** All domains on the server, as a list however Plesk chose to wrap them. */
  public List<JsonNode> domains() {
    Result result = get("/domains");
    if (!result.ok()) {
      return List.of();
    }
    JsonNode data = result.data();
    JsonNode array = data != null && data.isArray() ? data
        : (data == null ? null : data.path("domains"));
    if (array == null || !array.isArray()) {
      return List.of();
    }
    List<JsonNode> out = new java.util.ArrayList<>();
    array.forEach(out::add);
    return out;
  }

  /** One domain by its full name, with the id and document root it reports. */
  public Optional<Domain> lookupDomain(String fullDomain) {
    for (JsonNode domain : domains()) {
      String name = domain.path("name").asText("");
      String fqdn = domain.path("fqdn").asText("");
      if (fullDomain.equals(name) || fullDomain.equals(fqdn)) {
        return Optional.of(new Domain(
            firstNonBlank(domain.path("id").asText(""), domain.path("_id").asText("")),
            firstNonBlank(
                domain.path("www_root").asText(""),
                domain.path("document_root").asText(""))));
      }
    }
    return Optional.empty();
  }

  /** A Plesk domain reduced to what provisioning needs. */
  public record Domain(String id, String wwwRoot) {}

  // -------------------------------------------------------------- helpers

  private String basicAuth() {
    String credentials = adminUser + ":" + apiKey;
    return "Basic " + Base64.getEncoder()
        .encodeToString(credentials.getBytes(StandardCharsets.UTF_8));
  }

  private static String truncate(String body) {
    if (body == null) {
      return "";
    }
    String trimmed = body.trim();
    return trimmed.length() <= 200 ? trimmed : trimmed.substring(0, 200);
  }

  private static String firstNonBlank(String... values) {
    for (String value : values) {
      if (value != null && !value.isBlank()) {
        return value;
      }
    }
    return "";
  }

  private static String trim(String value) {
    return value == null ? "" : value.trim();
  }
}
