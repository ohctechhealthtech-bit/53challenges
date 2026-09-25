package com.fiftythree.challenges.plesk;

import com.fasterxml.jackson.databind.JsonNode;
import com.fiftythree.challenges.security.CallerResolver;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/**
 * The Java replacement for {@code pleskDiagnostic}: checks that Plesk is
 * reachable and that provisioning would work, using the same code paths the
 * provisioning functions use.
 *
 * <p><b>Admin-only, unlike the original.</b> The Base44 version took no
 * request and performed no authentication at all, while returning the panel
 * URL, the admin username, whether credentials are loaded, the server version
 * and a list of hosted domains — a map of the hosting, to anyone who knew the
 * path. That is a bug rather than a design decision, so it is not reproduced
 * here. Everything this returns is infrastructure detail, and infrastructure
 * detail is for administrators.
 *
 * <p>Read-only by construction: {@code GET /server} and {@code GET /domains},
 * nothing that creates, changes or deletes.
 */
@RestController
public class PleskDiagnosticController {

  /** Enough names to see the listing works, without dumping the estate. */
  private static final int MAX_DOMAIN_NAMES = 20;

  private final PleskClient plesk;
  private final CallerResolver caller;

  public PleskDiagnosticController(PleskClient plesk, CallerResolver caller) {
    this.plesk = plesk;
    this.caller = caller;
  }

  @PostMapping("/api/apps/{appId}/functions/pleskDiagnostic")
  public ResponseEntity<?> handle(@RequestBody(required = false) Map<String, Object> body) {
    Map<String, Object> request = body == null ? Map.of() : body;
    String sessionToken = str(request.get("session_token"));
    if (caller.email(sessionToken) == null) {
      return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
    }
    if (!caller.isAdmin(sessionToken)) {
      return ResponseEntity.status(403).body(Map.of("error", "Admin only"));
    }

    Map<String, Object> diagnostic = new LinkedHashMap<>();
    diagnostic.put("base_url", plesk.baseUrl());
    diagnostic.put("admin_user", plesk.adminUser());
    // Whether a credential exists, never the credential.
    diagnostic.put("api_key_loaded", plesk.hasApiKey());

    if (!plesk.isConfigured()) {
      diagnostic.put("error", plesk.missingConfiguration());
      diagnostic.put("rest_api_v2_ready", false);
      diagnostic.put("can_provision", false);
      return ResponseEntity.ok(diagnostic);
    }

    PleskClient.Result server = plesk.serverInfo();
    diagnostic.put("server_check", server.ok() ? "ok" : "failed");
    if (server.ok()) {
      diagnostic.put("server_info", server.data());
    } else {
      diagnostic.put("server_error", server.error());
    }

    // A separate check rather than an inference from the first: credentials
    // can authenticate to /server and still lack the permission to list
    // domains, which is exactly the case that breaks provisioning later.
    PleskClient.Result domainsResult = plesk.get("/domains");
    List<JsonNode> domains = domainsResult.ok() ? plesk.domains() : List.of();
    diagnostic.put("domains_check", domainsResult.ok() ? "ok" : "failed");
    if (domainsResult.ok()) {
      diagnostic.put("domain_count", domains.size());
      diagnostic.put("domain_names", names(domains));
    } else {
      diagnostic.put("domains_error", domainsResult.error());
    }

    boolean ready = server.ok() && domainsResult.ok();
    diagnostic.put("rest_api_v2_ready", ready);
    diagnostic.put("can_provision", ready);
    return ResponseEntity.ok(diagnostic);
  }

  private static List<String> names(List<JsonNode> domains) {
    List<String> out = new ArrayList<>();
    for (JsonNode domain : domains) {
      String name = domain.path("name").asText("");
      if (name.isBlank()) {
        name = domain.path("fqdn").asText("");
      }
      if (!name.isBlank()) {
        out.add(name);
      }
      if (out.size() >= MAX_DOMAIN_NAMES) {
        break;
      }
    }
    return out;
  }

  private static String str(Object value) {
    if (value == null) {
      return null;
    }
    String text = String.valueOf(value).trim();
    return text.isEmpty() ? null : text;
  }
}
