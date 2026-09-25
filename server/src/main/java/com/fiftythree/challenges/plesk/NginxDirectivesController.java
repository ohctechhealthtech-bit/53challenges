package com.fiftythree.challenges.plesk;

import com.fiftythree.challenges.domain.ChallengeDomainEntity;
import com.fiftythree.challenges.domain.ChallengeDomainRepository;
import com.fiftythree.challenges.security.CallerResolver;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/**
 * The Java replacement for {@code applyNginxDirectives}: re-applies the
 * {@code /api/} reverse-proxy configuration for an existing subdomain.
 *
 * <p>The write and the verdict are separate on purpose. Writing
 * {@code vhost_nginx.conf} usually fails, because the subscription's system
 * user has no business writing to the vhost conf directory; a root-level Plesk
 * task applies the directives instead, on its own schedule. So the write is
 * attempted and its failure tolerated, and <b>the health check decides</b>
 * what {@code nginx_status} becomes. Trusting the write would mark a subdomain
 * configured minutes before it actually is.
 */
@RestController
public class NginxDirectivesController {

  private static final Logger log = LoggerFactory.getLogger(NginxDirectivesController.class);

  private final PleskClient plesk;
  private final PleskShellOps shell;
  private final ChallengeDomainRepository domains;
  private final CallerResolver caller;

  public NginxDirectivesController(
      PleskClient plesk,
      PleskShellOps shell,
      ChallengeDomainRepository domains,
      CallerResolver caller) {
    this.plesk = plesk;
    this.shell = shell;
    this.domains = domains;
    this.caller = caller;
  }

  @PostMapping("/api/apps/{appId}/functions/applyNginxDirectives")
  public ResponseEntity<?> handle(@RequestBody(required = false) Map<String, Object> body) {
    Map<String, Object> request = body == null ? Map.of() : body;
    if (!caller.isAdmin(str(request.get("session_token")))) {
      return ResponseEntity.status(403).body(Map.of(
          "success", false, "error", "Only admins can apply nginx directives"));
    }

    String domainId = str(request.get("domain_id"));
    if (domainId == null) {
      return ResponseEntity.status(400).body(Map.of(
          "success", false, "error", "domain_id is required"));
    }
    Optional<ChallengeDomainEntity> found = domains.findById(domainId);
    if (found.isEmpty()) {
      return ResponseEntity.status(404).body(Map.of(
          "success", false, "error", "Domain record not found"));
    }
    ChallengeDomainEntity domain = found.get();

    if (!"subdomain".equals(nz(domain.getDomainType()))) {
      return ResponseEntity.status(400).body(Map.of(
          "success", false, "error", "nginx directives only apply to subdomains"));
    }
    if (!plesk.isConfigured()) {
      return ResponseEntity.status(500).body(Map.of(
          "success", false, "error", "Plesk is not configured"));
    }

    String fullDomain = nz(domain.getFullDomain());
    PleskShellOps.ShellResult write = shell.setupReverseProxy(fullDomain);
    log.info("applyNginxDirectives write for {}: success={} method={}",
        fullDomain, write.success(), write.method());

    PleskShellOps.ProxyHealth health = shell.checkProxyHealth(fullDomain);
    String nginxStatus = health.healthy() ? "configured" : "pending";

    domain.setNginxStatus(nginxStatus);
    domain.setErrorMessage(health.healthy() ? "" : "Awaiting server-side nginx sync");
    domain.setUpdatedDate(Instant.now());
    domains.save(domain);

    Map<String, Object> out = new LinkedHashMap<>();
    out.put("success", true);
    out.put("nginx_status", nginxStatus);
    out.put("healthy", health.healthy());
    out.put("status_code", health.statusCode());
    if (!health.healthy()) {
      out.put("error", "Awaiting server-side nginx sync");
    }
    return ResponseEntity.ok(out);
  }

  private static String nz(String value) {
    return value == null ? "" : value;
  }

  private static String str(Object value) {
    if (value == null) {
      return null;
    }
    String text = String.valueOf(value).trim();
    return text.isEmpty() ? null : text;
  }
}
