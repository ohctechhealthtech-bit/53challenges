package com.fiftythree.challenges.plesk;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;

import org.junit.jupiter.api.Test;

/**
 * The nginx a challenge subdomain is given.
 *
 * <p>These directives are written to a vhost and then applied by a Plesk
 * reconfigure, so a mistake does not surface as a failing request — it
 * surfaces as a subdomain that will not come up at all, minutes later, on a
 * machine nobody is watching. Cheap to pin here.
 */
class ProxyDirectivesTest {

  private PleskShellOps ops(String target, String fallback) {
    return new PleskShellOps(mock(PleskClient.class), target, fallback);
  }

  private static int countLocations(String directives, String prefix) {
    int count = 0;
    for (String line : directives.split("\n")) {
      if (line.trim().startsWith(prefix)) {
        count++;
      }
    }
    return count;
  }

  /**
   * Two {@code location /api/} blocks in one server context is an nginx
   * configuration error. A cron on the server appends its own, so the one
   * written here must be the only one this code contributes.
   */
  @Test
  void thereIsExactlyOneApiCatchAll() {
    String directives = ops("http://127.0.0.1:8081", "https://base44.app").proxyDirectives();

    assertEquals(1, countLocations(directives, "location /api/ {"));
  }

  @Test
  void portedRoutesGoToThisApplicationAndTheRestUpstream() {
    String directives = ops("http://127.0.0.1:8081", "https://base44.app").proxyDirectives();

    int javaAt = directives.indexOf("proxy_pass http://127.0.0.1:8081;");
    int upstreamAt = directives.indexOf("proxy_pass https://base44.app;");
    assertTrue(javaAt >= 0, "ported routes must reach this application");
    assertTrue(upstreamAt >= 0, "unported routes must still reach Base44");
    // nginx prefers a matching regex over a prefix, so order does not decide
    // this — but the regex block must exist, or /api/ swallows everything.
    assertTrue(directives.contains("location ~ ^/api/apps/[^/]+/(functions|entities)/ {"));
  }

  /**
   * Sending all of /api/ to this app would 404 the SDK's own platform calls,
   * which have no route here. The catch-all must stay pointed upstream.
   */
  @Test
  void theCatchAllIsNotPointedAtThisApplication() {
    String directives = ops("http://127.0.0.1:8081", "https://base44.app").proxyDirectives();

    String catchAll = directives.substring(directives.indexOf("location /api/ {"));
    assertTrue(catchAll.contains("https://base44.app"),
        "the catch-all must forward unported calls, not answer them here");
    assertTrue(!catchAll.contains("127.0.0.1:8081"));
  }

  @Test
  void bothTargetsAreConfigurable() {
    String directives = ops("http://127.0.0.1:9999", "https://elsewhere.example").proxyDirectives();

    assertTrue(directives.contains("proxy_pass http://127.0.0.1:9999;"));
    assertTrue(directives.contains("proxy_pass https://elsewhere.example;"));
  }

  @Test
  void blankTargetsFallBackToTheDefaults() {
    String directives = ops("  ", null).proxyDirectives();

    assertTrue(directives.contains("proxy_pass http://127.0.0.1:8081;"));
    assertTrue(directives.contains("proxy_pass https://base44.app;"));
  }
}
