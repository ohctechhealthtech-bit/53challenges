package com.fiftythree.challenges.upstream;

import jakarta.servlet.http.HttpServletRequest;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Enumeration;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RestController;

/**
 * Forwards any Base44 function this API has not yet implemented on to Base44.
 *
 * <p>Without it, every newly ported function needs its name added to an nginx
 * allowlist, and forgetting to do so in the right order turns a working
 * endpoint into a 404 — which has already happened once here. With it, nginx
 * sends the whole {@code /functions/} prefix to this application once and never
 * needs touching again: implemented functions are served locally, and the rest
 * pass straight through.
 *
 * <p>Spring matches a literal path in preference to one with a variable, so a
 * function with its own controller always wins over this.
 *
 * <p><b>The trade-off is deliberate and worth stating.</b> This makes the Java
 * process a dependency of every function rather than only the ported ones, so
 * if it is down, all of them are — not just the migrated handful. That risk is
 * covered by deploy.sh, which waits for the app to genuinely answer and rolls
 * back automatically when it does not.
 */
@RestController
public class FunctionFallbackController {

  private static final Logger log = LoggerFactory.getLogger(FunctionFallbackController.class);

  /**
   * Headers that belong to this hop and must not be copied onward: the
   * connection-level ones, and the length and encoding, which the client
   * recomputes for the body it actually sends.
   */
  private static final Set<String> HOP_BY_HOP = Set.of(
      "host", "connection", "keep-alive", "proxy-authenticate", "proxy-authorization",
      "te", "trailer", "transfer-encoding", "upgrade", "content-length", "expect",
      // accept-encoding is dropped deliberately, and it is the important one.
      // Forwarding the browser's "gzip, deflate, br" makes Base44 answer
      // compressed; Java's HttpClient does not decompress unless asked, so the
      // bytes come back still compressed and get relayed as application/json
      // with no Content-Encoding header. The browser then tries to parse gzip
      // as JSON and every proxied call silently returns garbage — which curl
      // never reproduces, because curl sends no Accept-Encoding by default.
      "accept-encoding");

  private final HttpClient http =
      HttpClient.newBuilder()
          .connectTimeout(Duration.ofSeconds(10))
          .followRedirects(HttpClient.Redirect.NEVER)
          .build();

  /**
   * Where an unported function is forwarded.
   *
   * <p>Configurable rather than fixed, so that decommissioning Base44 is a
   * setting and not a rebuild. Every function now has a local route, which
   * makes this a safety net: if it ever fires, the log line below names the
   * function that slipped through.
   */
  private final String fallbackBase;

  private final String appId;

  public FunctionFallbackController(
      @Value("${app.base44.app-id:}") String appId,
      @Value("${app.base44.fallback-url:https://base44.app}") String fallbackBase) {
    this.appId = appId;
    this.fallbackBase = fallbackBase == null || fallbackBase.isBlank()
        ? "https://base44.app"
        : fallbackBase.trim().replaceAll("/+$", "");
  }

  @RequestMapping(
      value = "/api/apps/{appId}/functions/{function}",
      method = {RequestMethod.GET, RequestMethod.POST})
  public ResponseEntity<byte[]> forward(
      @PathVariable("appId") String pathAppId,
      @PathVariable("function") String function,
      @RequestBody(required = false) byte[] body,
      HttpServletRequest request) {

    String query = request.getQueryString();
    String target = fallbackBase + "/api/apps/" + pathAppId + "/functions/" + function
        + (query == null || query.isBlank() ? "" : "?" + query);

    try {
      HttpRequest.Builder builder = HttpRequest.newBuilder(URI.create(target))
          .timeout(Duration.ofSeconds(60));

      // Every header the caller sent is passed on, including Authorization and
      // any cookie: Base44 authenticates these requests itself, and stripping
      // them would silently turn a signed-in caller into an anonymous one.
      Enumeration<String> names = request.getHeaderNames();
      while (names != null && names.hasMoreElements()) {
        String name = names.nextElement();
        if (HOP_BY_HOP.contains(name.toLowerCase(Locale.ROOT))) {
          continue;
        }
        Enumeration<String> values = request.getHeaders(name);
        while (values.hasMoreElements()) {
          builder.header(name, values.nextElement());
        }
      }

      // Ask upstream for an uncompressed body explicitly. nginx re-compresses
      // on the way out to the browser, so nothing is lost over the wire.
      builder.setHeader("Accept-Encoding", "identity");

      if ("GET".equalsIgnoreCase(request.getMethod())) {
        builder.GET();
      } else {
        builder.POST(body == null
            ? HttpRequest.BodyPublishers.noBody()
            : HttpRequest.BodyPublishers.ofByteArray(body));
      }

      HttpResponse<byte[]> response =
          http.send(builder.build(), HttpResponse.BodyHandlers.ofByteArray());

      log.debug("Proxied {} to Base44 → {}", function, response.statusCode());

      HttpHeaders out = new HttpHeaders();
      String contentType = response.headers().firstValue("content-type")
          .orElse("application/json");
      out.add(HttpHeaders.CONTENT_TYPE, contentType);
      // Cookies are passed back so a Base44 session set upstream still reaches
      // the browser.
      List<String> setCookie = response.headers().allValues("set-cookie");
      setCookie.forEach(c -> out.add(HttpHeaders.SET_COOKIE, c));

      return ResponseEntity.status(response.statusCode()).headers(out).body(response.body());
    } catch (Exception e) {
      log.error("Proxying {} to Base44 failed", function, e);
      String message = "{\"error\":\"Upstream function unavailable\"}";
      HttpHeaders out = new HttpHeaders();
      out.add(HttpHeaders.CONTENT_TYPE, "application/json");
      return ResponseEntity.status(502).headers(out)
          .body(message.getBytes(StandardCharsets.UTF_8));
    }
  }
}
