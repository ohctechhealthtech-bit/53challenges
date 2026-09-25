package com.fiftythree.challenges.plesk;

import com.fiftythree.challenges.domain.ChallengeDomainEntity;
import com.fiftythree.challenges.domain.ChallengeDomainRepository;
import com.fiftythree.challenges.entity.AdminSslConfigurationEntity;
import com.fiftythree.challenges.entity.AdminSslConfigurationRepository;
import com.fiftythree.challenges.entity.ChallengeRepository;
import com.fiftythree.challenges.security.CallerResolver;
import com.fiftythree.challenges.upstream.ChallengeApiClient;
import com.fasterxml.jackson.databind.JsonNode;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/**
 * The Java replacement for {@code provisionDomain}: the full provisioning
 * flow, for both challenge subdomains and independent domains.
 *
 * <p>Where {@code createChallengeSubdomain} handles the simple case, this
 * carries the whole sequence — validate, record, create in Plesk, deploy the
 * repository, install the certificate, configure the reverse proxy — and it is
 * written so that a failure at any step leaves something an operator can read
 * rather than a half-made domain nobody can account for.
 *
 * <p>Three properties are worth stating:
 *
 * <ul>
 *   <li><b>It is resumable.</b> A domain that already exists in Plesk from a
 *       failed attempt is reused rather than treated as a conflict, and
 *       earlier failed records are retired so one live row remains per name.
 *   <li><b>A subdomain requires the default certificate to exist</b> before
 *       anything is created. A subdomain served over plain HTTP is worse than
 *       one that was never made.
 *   <li><b>Errors are named, not echoed.</b> Plesk's own wording rarely says
 *       what to do; {@code CONFIG_MISSING_DEFAULT_IP} and
 *       {@code PLESK_SUBSCRIPTION_REQUIRED} do.
 * </ul>
 */
@RestController
public class ProvisionDomainController {

  private static final Logger log = LoggerFactory.getLogger(ProvisionDomainController.class);

  private static final Set<String> DOMAIN_TYPES = Set.of("subdomain", "full_domain");

  /** Statuses that mean a live row already owns this name. */
  private static final Set<String> BLOCKING = Set.of(
      "active", "provisioning", "pending", "dns_pending", "deployed", "ssl_pending");

  private final PleskClient plesk;
  private final PleskProvisioning provisioning;
  private final PleskShellOps shell;
  private final PrivateFileStore files;
  private final ChallengeDomainRepository domains;
  private final ChallengeRepository challenges;
  private final AdminSslConfigurationRepository sslConfigurations;
  private final ChallengeApiClient upstream;
  private final CallerResolver caller;

  public ProvisionDomainController(
      PleskClient plesk,
      PleskProvisioning provisioning,
      PleskShellOps shell,
      PrivateFileStore files,
      ChallengeDomainRepository domains,
      ChallengeRepository challenges,
      AdminSslConfigurationRepository sslConfigurations,
      ChallengeApiClient upstream,
      CallerResolver caller) {
    this.plesk = plesk;
    this.provisioning = provisioning;
    this.shell = shell;
    this.files = files;
    this.domains = domains;
    this.challenges = challenges;
    this.sslConfigurations = sslConfigurations;
    this.upstream = upstream;
    this.caller = caller;
  }

  @PostMapping("/api/apps/{appId}/functions/provisionDomain")
  public ResponseEntity<?> handle(@RequestBody(required = false) Map<String, Object> body) {
    Map<String, Object> request = body == null ? Map.of() : body;
    if (!caller.isAdmin(str(request.get("session_token")))) {
      return error("VALIDATION_ERROR", "Only admins can provision domains", 403);
    }

    String domainType = str(request.get("domain_type"));
    if (domainType == null || !DOMAIN_TYPES.contains(domainType)) {
      return error("VALIDATION_ERROR", "domain_type must be subdomain or full_domain", 400);
    }
    boolean isSubdomain = "subdomain".equals(domainType);

    String challengeId = str(request.get("challenge_id"));
    if (isSubdomain && challengeId == null) {
      return error("VALIDATION_ERROR", "challenge_id is required for a subdomain", 400);
    }

    // A full domain must carry a repository — there is nothing else to serve
    // from it. A subdomain may, and validates it only when present.
    String gitLocation = str(request.get("git_location"));
    if (!isSubdomain && gitLocation == null) {
      return error("VALIDATION_ERROR", "Git repository URL is required", 400);
    }
    if (gitLocation != null) {
      SubdomainValidation.Result git = SubdomainValidation.validateGitUrl(gitLocation);
      if (!git.valid()) {
        return error("VALIDATION_ERROR", git.error(), 400);
      }
    }

    if (!plesk.isConfigured()) {
      return error("PLESK_NOT_CONFIGURED", plesk.missingConfiguration(), 500);
    }
    String baseDomain = plesk.baseDomain();

    String slug = "";
    String fullDomain;
    if (isSubdomain) {
      SubdomainValidation.Result validation =
          SubdomainValidation.validateSlug(str(request.get("slug")));
      if (!validation.valid()) {
        return error("VALIDATION_ERROR", validation.error(), 400);
      }
      slug = validation.normalized();
      fullDomain = slug + "." + baseDomain;
    } else {
      SubdomainValidation.Result validation =
          SubdomainValidation.validateFullDomain(str(request.get("full_domain")));
      if (!validation.valid()) {
        return error("VALIDATION_ERROR", validation.error(), 400);
      }
      fullDomain = validation.normalized();
    }

    String certUrl = str(request.get("ssl_cert_url"));
    String keyUrl = str(request.get("ssl_key_url"));
    if (!isSubdomain && (certUrl == null || keyUrl == null)) {
      return error("VALIDATION_ERROR",
          "SSL certificate and private key are required for full domains", 400);
    }

    String challengeName = "";
    if (isSubdomain) {
      challengeName = resolveChallengeName(challengeId);
      if (challengeName.isEmpty()) {
        return error("CHALLENGE_NOT_FOUND",
            "The selected challenge could not be found. Please refresh and try again.", 404);
      }
    }

    // One live row per name. Earlier failures are retired rather than deleted,
    // so the history survives.
    List<ChallengeDomainEntity> existing = domains.findByHost(fullDomain);
    if (existing.stream().anyMatch(d -> BLOCKING.contains(nz(d.getStatus())))) {
      return error("DUPLICATE_DOMAIN", "A domain with this name already exists", 409);
    }
    for (ChallengeDomainEntity failed : existing) {
      if ("failed".equals(nz(failed.getStatus()))) {
        failed.setStatus("deleted");
        failed.setUpdatedDate(Instant.now());
        domains.save(failed);
      }
    }

    // Checked before anything is created: a subdomain with no certificate
    // would be served over plain HTTP, which is worse than not existing.
    AdminSslConfigurationEntity defaultSsl = null;
    if (isSubdomain) {
      defaultSsl = sslConfigurations.findAll().stream()
          .filter(c -> Boolean.TRUE.equals(c.getIsActive()))
          .findFirst()
          .orElse(null);
      if (defaultSsl == null) {
        return error("SSL_NOT_CONFIGURED",
            "No active admin default SSL configuration. "
                + "Please configure one before creating subdomains.", 400);
      }
    }

    Optional<PleskClient.Domain> alreadyInPlesk = plesk.lookupDomain(fullDomain);

    Instant now = Instant.now();
    ChallengeDomainEntity record = new ChallengeDomainEntity();
    record.setId(newId());
    record.setChallengeId(orEmpty(challengeId));
    record.setChallengeName(challengeName);
    record.setDomainType(domainType);
    record.setSlug(slug);
    record.setBaseDomain(isSubdomain ? baseDomain : fullDomain);
    record.setFullDomain(fullDomain);
    record.setFullUrl("https://" + fullDomain);
    record.setParentDomain(baseDomain);
    record.setStatus("provisioning");
    record.setHostingMode(isSubdomain ? "separate_subdomain" : "full_domain");
    record.setGitLocation(orEmpty(gitLocation));
    record.setGitDeploymentStatus(gitLocation == null ? "skipped" : "pending");
    record.setSslCertUrl(orEmpty(certUrl));
    record.setSslKeyUrl(orEmpty(keyUrl));
    record.setSslStatus("pending");
    record.setSslSource(isSubdomain && certUrl == null ? "admin_default" : "manual");
    record.setCreatedDate(now);
    record.setUpdatedDate(now);
    record.setIsSample(false);
    domains.save(record);

    // Reused rather than refused: reaching here with the domain present means
    // an earlier attempt created it and then failed, and its record has just
    // been retired.
    String siteId;
    String documentRoot;
    if (alreadyInPlesk.isPresent()) {
      siteId = alreadyInPlesk.get().id();
      documentRoot = alreadyInPlesk.get().wwwRoot();
      log.info("Reusing existing Plesk domain {} from a previous attempt", fullDomain);
    } else {
      PleskProvisioning.Provisioned created = isSubdomain
          ? provisioning.createSubdomain(slug)
          : provisioning.createFullDomain(fullDomain);
      if (!created.success()) {
        return fail(record, "PLESK_CREATE_FAILED",
            orDefault(created.error(), "Domain creation failed"), 502);
      }
      siteId = created.siteId();
      documentRoot = created.documentRoot();
    }

    record.setPleskSiteId(orEmpty(siteId));
    record.setDocumentRoot(orEmpty(documentRoot));
    domains.save(record);

    if (gitLocation != null) {
      record.setGitDeploymentStatus("cloning");
      domains.save(record);

      PleskShellOps.ShellResult cloned =
          shell.cloneGit(gitLocation, documentRoot, siteId);
      if (!cloned.success()) {
        // A domain with no content is a broken domain, so this is fatal here —
        // unlike in createChallengeSubdomain, where git is optional extra.
        record.setGitDeploymentStatus("failed");
        return fail(record, "GIT_DEPLOY_FAILED",
            orDefault(cloned.error(), "Git deployment failed."), 502);
      }
      record.setGitDeploymentStatus("deployed");
    }

    record.setStatus("ssl_pending");
    record.setSslStatus("installing");
    domains.save(record);

    PleskShellOps.ShellResult ssl = installCertificate(
        record, defaultSsl, certUrl, keyUrl, fullDomain, siteId);
    record.setSslStatus(ssl.success() ? "installed" : "failed");
    if (!ssl.success()) {
      // Not fatal. The domain exists and serves; the certificate can be
      // installed again from the admin screen once whatever went wrong is
      // fixed, and saying so is more useful than tearing the domain down.
      record.setErrorMessage(ssl.error());
    }

    if (isSubdomain) {
      PleskShellOps.ShellResult proxy = shell.setupReverseProxy(fullDomain);
      PleskShellOps.ProxyHealth health = shell.checkProxyHealth(fullDomain);
      record.setNginxStatus(health.healthy() ? "configured" : "pending");
      if (!health.healthy() && !proxy.success()) {
        log.info("Reverse proxy for {} awaiting server-side nginx sync", fullDomain);
      }
    }

    record.setStatus("active");
    record.setUpdatedDate(Instant.now());
    domains.save(record);

    Map<String, Object> out = new LinkedHashMap<>();
    out.put("ok", true);
    out.put("domain", toJson(record));
    return ResponseEntity.ok(out);
  }

  /**
   * Installs whichever certificate applies.
   *
   * <p>A subdomain uses the stored default unless the request supplied its
   * own; a full domain must supply one. The default is read from private
   * storage rather than fetched over HTTP, which is both faster and avoids a
   * signed-URL round trip the original needed only because Base44 held the
   * file remotely.
   */
  private PleskShellOps.ShellResult installCertificate(
      ChallengeDomainEntity record,
      AdminSslConfigurationEntity defaultSsl,
      String certUrl,
      String keyUrl,
      String fullDomain,
      String siteId) {

    try {
      if (certUrl == null && defaultSsl != null) {
        String certificate = files.read(defaultSsl.getCertificateFileReference());
        String key = files.read(defaultSsl.getPrivateKeyFileReference());
        return shell.installCertificate(fullDomain, certificate, key, siteId);
      }
      if (certUrl == null) {
        return PleskShellOps.ShellResult.failed("No certificate available to install");
      }
      return shell.installCertificate(fullDomain,
          fetchPem(certUrl), keyUrl == null ? "" : fetchPem(keyUrl), siteId);
    } catch (Exception e) {
      log.warn("Certificate install for {} failed: {}", fullDomain, e.toString());
      return PleskShellOps.ShellResult.failed(
          e.getMessage() == null ? "Could not install the certificate" : e.getMessage());
    }
  }

  /** Only https, for the same reason as in the subdomain controller. */
  private String fetchPem(String url) throws Exception {
    java.net.URI uri = java.net.URI.create(url);
    if (!"https".equalsIgnoreCase(uri.getScheme())) {
      throw new IllegalArgumentException("Certificate URLs must use https://");
    }
    var request = java.net.http.HttpRequest.newBuilder(uri)
        .timeout(java.time.Duration.ofSeconds(20)).GET().build();
    var response = java.net.http.HttpClient.newBuilder()
        .connectTimeout(java.time.Duration.ofSeconds(10))
        .followRedirects(java.net.http.HttpClient.Redirect.NEVER)
        .build()
        .send(request, java.net.http.HttpResponse.BodyHandlers.ofString());
    if (response.statusCode() >= 400) {
      throw new IllegalArgumentException(
          "The certificate URL returned HTTP " + response.statusCode());
    }
    return response.body();
  }

  /**
   * The challenge's title, from the local record or the upstream API.
   *
   * <p>Both are consulted because the two hold different challenges: the long
   * running ones live upstream and were never copied into this database.
   */
  private String resolveChallengeName(String challengeId) {
    String local = challenges.findById(challengeId)
        .map(c -> nz(c.getTitle()))
        .orElse("");
    if (!local.isEmpty()) {
      return local;
    }
    try {
      for (JsonNode challenge : upstream.challenges(
          Map.of("id", challengeId, "include_inactive", "true"))) {
        if (challengeId.equals(challenge.path("id").asText(""))) {
          return challenge.path("title").asText("");
        }
      }
    } catch (Exception e) {
      log.warn("Upstream challenge lookup failed for {}: {}", challengeId, e.toString());
    }
    return "";
  }

  private ResponseEntity<?> fail(
      ChallengeDomainEntity record, String code, String message, int status) {
    record.setStatus("failed");
    record.setErrorMessage(message);
    record.setUpdatedDate(Instant.now());
    domains.save(record);
    return error(code, message, status);
  }

  private static ResponseEntity<?> error(String code, String message, int status) {
    Map<String, Object> out = new LinkedHashMap<>();
    out.put("success", false);
    out.put("error_code", code);
    out.put("error", message);
    return ResponseEntity.status(status).body(out);
  }

  private static Map<String, Object> toJson(ChallengeDomainEntity d) {
    Map<String, Object> out = new LinkedHashMap<>();
    out.put("id", d.getId());
    out.put("challenge_id", d.getChallengeId());
    out.put("challenge_name", d.getChallengeName());
    out.put("domain_type", d.getDomainType());
    out.put("slug", d.getSlug());
    out.put("base_domain", d.getBaseDomain());
    out.put("full_domain", d.getFullDomain());
    out.put("full_url", d.getFullUrl());
    out.put("status", d.getStatus());
    out.put("hosting_mode", d.getHostingMode());
    out.put("git_deployment_status", d.getGitDeploymentStatus());
    out.put("ssl_status", d.getSslStatus());
    out.put("ssl_source", d.getSslSource());
    out.put("nginx_status", d.getNginxStatus());
    out.put("plesk_site_id", d.getPleskSiteId());
    out.put("document_root", d.getDocumentRoot());
    out.put("error_message", d.getErrorMessage());
    out.put("created_date", d.getCreatedDate() == null ? null : d.getCreatedDate().toString());
    return out;
  }

  private static String orDefault(String value, String fallback) {
    return value == null || value.isBlank() ? fallback : value;
  }

  private static String orEmpty(String value) {
    return value == null ? "" : value;
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

  private static String newId() {
    return UUID.randomUUID().toString().replace("-", "").substring(0, 24);
  }
}
