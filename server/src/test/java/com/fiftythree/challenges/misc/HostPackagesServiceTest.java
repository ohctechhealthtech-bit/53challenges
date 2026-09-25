package com.fiftythree.challenges.misc;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpServer;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

/**
 * The hosting packages a host sees, fetched from the parent app.
 *
 * <p>Served by a real local HTTP server rather than a mock, because the thing
 * most likely to break is the parsing of what the parent actually sends, and a
 * stubbed client would only prove the parser agrees with itself.
 */
class HostPackagesServiceTest {

  private HttpServer server;

  @AfterEach
  void stop() {
    if (server != null) {
      server.stop(0);
    }
  }

  /** Starts a parent that answers hostPackagesApi with this body and status. */
  private HostPackagesService parentReturning(int status, String body) throws Exception {
    server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
    server.createContext("/functions/hostPackagesApi", exchange -> {
      byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
      exchange.sendResponseHeaders(status, bytes.length);
      try (OutputStream out = exchange.getResponseBody()) {
        out.write(bytes);
      }
    });
    server.start();
    String base = "http://127.0.0.1:" + server.getAddress().getPort() + "/functions/anything";
    return new HostPackagesService(new ObjectMapper(), base, "test-key");
  }

  @Test
  void packagesAreNormalisedAndSortedByDisplayOrder() throws Exception {
    HostPackagesService service = parentReturning(200, """
        {"packages":[
          {"key":"b","name":"Bigger","price":"$900","sort_order":2,
           "features":["Two judges"],"highlighted":true},
          {"key":"a","name":"Starter","price":"$300","sort_order":1,
           "features_intro":"Everything you need:","features":["One challenge","Email support"]}
        ]}
        """);

    List<Map<String, Object>> packages = service.activePackages();

    assertEquals(2, packages.size());
    assertEquals("a", packages.get(0).get("key"), "sort_order decides the order, not input order");
    assertEquals("Starter", packages.get(0).get("name"));
    assertEquals(true, packages.get(1).get("highlight"));
    // The intro leads the benefit list, which is how the pricing card reads it.
    assertEquals(List.of("Everything you need:", "One challenge", "Email support"),
        packages.get(0).get("benefits"));
    assertTrue(!packages.get(0).containsKey("_sort"), "the sort key must not leak to the client");
  }

  /**
   * Only an explicit false hides a package. A parent that omits the flag
   * entirely must not have its whole catalogue disappear.
   */
  @Test
  void onlyAnExplicitlyInactivePackageIsHidden() throws Exception {
    HostPackagesService service = parentReturning(200, """
        {"packages":[
          {"key":"live","name":"Live","is_active":true},
          {"key":"hidden","name":"Hidden","is_active":false},
          {"key":"unflagged","name":"Unflagged"}
        ]}
        """);

    List<String> keys = service.activePackages().stream()
        .map(p -> (String) p.get("key")).toList();

    assertEquals(List.of("live", "unflagged"), keys);
  }

  /**
   * The pricing page must not render an empty price list when the parent is
   * down — "we offer nothing" is a worse answer than "try again".
   */
  @Test
  void anUpstreamFailureIsRaisedRatherThanReturnedAsNoPackages() throws Exception {
    HostPackagesService service = parentReturning(500, "{}");

    assertThrows(HostPackagesService.PackagesUnavailableException.class,
        service::activePackages);
  }

  @Test
  void malformedJsonIsTreatedAsUnavailable() throws Exception {
    HostPackagesService service = parentReturning(200, "not json at all");

    assertThrows(HostPackagesService.PackagesUnavailableException.class,
        service::activePackages);
  }

  /**
   * The workspace swallows the same failure deliberately: packages are one
   * panel among many, and a dashboard that renders without it beats one that
   * will not load.
   */
  @Test
  void theWorkspaceVariantDegradesToAnEmptyList() throws Exception {
    HostPackagesService service = parentReturning(503, "{}");

    assertEquals(List.of(), service.activePackagesOrEmpty());
  }

  @Test
  void anUnreachableParentDoesNotPropagateAnIoException() throws Exception {
    // Port 1 is reserved and nothing listens on it.
    HostPackagesService service =
        new HostPackagesService(new ObjectMapper(), "http://127.0.0.1:1/functions/x", "k");

    assertEquals(List.of(), service.activePackagesOrEmpty());
    assertThrows(HostPackagesService.PackagesUnavailableException.class,
        service::activePackages);
  }
}
