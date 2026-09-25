package com.fiftythree.challenges.misc;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/**
 * The hosting packages, which live on the parent app.
 *
 * <p>Two callers want the same list — the public pricing page through
 * {@code hostPackages}, and a host's workspace — so the fetch and the
 * normalisation live here rather than in either controller. The port
 * originally had it in the controller, and the workspace consequently shipped
 * an empty list where the Base44 version called {@code hostPackages} and
 * showed the real thing.
 */
@Service
public class HostPackagesService {

  private static final Logger log = LoggerFactory.getLogger(HostPackagesService.class);

  private final HttpClient http =
      HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();

  private final ObjectMapper mapper;
  private final String upstreamBase;
  private final String apiKey;

  public HostPackagesService(
      ObjectMapper mapper,
      @Value("${app.upstream.base-url}") String upstreamBase,
      @Value("${app.upstream.api-key}") String apiKey) {
    this.mapper = mapper;
    this.upstreamBase = upstreamBase;
    this.apiKey = apiKey;
  }

  /** Raised when the parent could not be reached or refused. */
  public static class PackagesUnavailableException extends RuntimeException {
    public PackagesUnavailableException(String message) {
      super(message);
    }
  }

  /**
   * Active packages in display order.
   *
   * @throws PackagesUnavailableException when the parent did not answer, so the
   *     pricing page can report it rather than render an empty price list that
   *     looks like "we offer nothing"
   */
  public List<Map<String, Object>> activePackages() {
    HttpResponse<String> response;
    try {
      HttpRequest request = HttpRequest.newBuilder(URI.create(sibling("hostPackagesApi")))
          .timeout(Duration.ofSeconds(20))
          .header("Content-Type", "application/json")
          .header("x-api-key", apiKey)
          .POST(HttpRequest.BodyPublishers.ofString("{}"))
          .build();
      response = http.send(request, HttpResponse.BodyHandlers.ofString());
    } catch (Exception e) {
      log.error("Could not reach the parent for hosting packages", e);
      throw new PackagesUnavailableException("Hosting packages are unavailable right now.");
    }

    if (response.statusCode() / 100 != 2) {
      log.warn("Hosting packages returned HTTP {}", response.statusCode());
      throw new PackagesUnavailableException("Hosting packages are unavailable right now.");
    }

    JsonNode data;
    try {
      data = mapper.readTree(response.body());
    } catch (Exception e) {
      throw new PackagesUnavailableException("Hosting packages are unavailable right now.");
    }

    List<Map<String, Object>> packages = new ArrayList<>();
    for (JsonNode p : data.path("packages")) {
      // Absent means active; only an explicit false hides a package.
      if (p.path("is_active").isBoolean() && !p.path("is_active").asBoolean()) {
        continue;
      }
      List<String> benefits = new ArrayList<>();
      String intro = p.path("features_intro").asText("");
      if (!intro.isEmpty()) {
        benefits.add(intro);
      }
      for (JsonNode f : p.path("features")) {
        benefits.add(f.asText(""));
      }

      Map<String, Object> out = new LinkedHashMap<>();
      out.put("key", p.path("key").asText(""));
      out.put("name", p.path("name").asText(""));
      out.put("tagline", p.path("tagline").asText(""));
      out.put("price", p.path("price").asText(""));
      out.put("priceNote", p.path("price_note").asText(""));
      out.put("audience", p.path("audience").asText(""));
      out.put("benefits", benefits);
      out.put("cta", p.path("cta").asText(""));
      out.put("badge", p.path("badge").asText(""));
      out.put("highlight", p.path("highlighted").asBoolean(false));
      out.put("_sort", p.path("sort_order").asInt(0));
      packages.add(out);
    }

    packages.sort((a, b) -> Integer.compare((int) a.get("_sort"), (int) b.get("_sort")));
    packages.forEach(p -> p.remove("_sort"));
    return packages;
  }

  /**
   * Active packages, or an empty list when the parent cannot be reached.
   *
   * <p>For callers where packages are one panel among many. The Base44
   * workspace swallowed this failure too — a dashboard that renders without
   * its pricing panel is better than one that fails to load at all.
   */
  public List<Map<String, Object>> activePackagesOrEmpty() {
    try {
      return activePackages();
    } catch (PackagesUnavailableException e) {
      log.warn("Workspace rendered without packages: {}", e.getMessage());
      return List.of();
    }
  }

  /**
   * A sibling function on the parent app, derived from the configured base URL
   * by swapping the trailing function name.
   */
  private String sibling(String name) {
    return upstreamBase.replaceAll("/[^/]*$", "/" + name);
  }
}
