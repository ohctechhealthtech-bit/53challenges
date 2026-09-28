package com.fiftythree.challenges.plesk;

import com.fiftythree.challenges.domain.ChallengeDomainEntity;
import com.fiftythree.challenges.domain.ChallengeDomainRepository;
import com.fiftythree.challenges.entity.ChallengeEntity;
import com.fiftythree.challenges.entity.ChallengeRepository;
import com.fiftythree.challenges.security.CallerResolver;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
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
 * The Java replacement for {@code createChallengeSubdomain} and
 * {@code deleteChallengeSubdomain}: the per-challenge hostnames like
 * {@code singing.53chal.com}.
 *
 * <p>Two hosting modes. <b>wildcard</b> needs no provisioning at all —
 * {@code *.basedomain} already resolves, so the record is simply marked
 * active. <b>separate_subdomain</b> creates a real subdomain in Plesk.
 *
 * <p>The ordering matters and is preserved from the original: Plesk is checked
 * for an existing domain <em>before</em> any record is written, so a clash
 * leaves neither an orphaned database row nor a half-made subdomain. The
 * record is then created as {@code provisioning} and only moves to
 * {@code active} once Plesk has confirmed, so a crash in between leaves
 * something visibly unfinished rather than something that looks ready.
 *
 * <p>Deletion is a soft delete. The row is retired rather than removed so the
 * audit trail survives, and a Plesk teardown failure still retires it —
 * leaving the row active would strand it — with the reason recorded and
 * returned as a warning.
 */
@RestController
public class ChallengeSubdomainController {

  private static final Logger log = LoggerFactory.getLogger(ChallengeSubdomainController.class);

  private static final Set<String> HOSTING_MODES = Set.of("wildcard", "separate_subdomain");

  /** Statuses that mean a live row already owns this slug. */
  private static final Set<String> BLOCKING_STATUSES =
      Set.of("active", "provisioning", "pending");

  /** Statuses whose Plesk side still needs tearing down. */
  private static final Set<String> NEEDS_TEARDOWN =
      Set.of("active", "dns_pending", "deployed", "ssl_pending");

  private final PleskClient plesk;
  private final PleskProvisioning provisioning;
  private final PleskShellOps shell;
  private final ChallengeDomainRepository domains;
  private final ChallengeRepository challenges;
  private final CallerResolver caller;
  private final PrivateFileStore files;

  public ChallengeSubdomainController(
      PleskClient plesk,
      PleskProvisioning provisioning,
      PleskShellOps shell,
      ChallengeDomainRepository domains,
      ChallengeRepository challenges,
      CallerResolver caller,
      PrivateFileStore files) {
    this.plesk = plesk;
    this.provisioning = provisioning;
    this.shell = shell;
    this.domains = domains;
    this.challenges = challenges;
    this.caller = caller;
    this.files = files;
  }

  // -------------------------------------------------------------- create

  @PostMapping("/api/apps/{appId}/functions/createChallengeSubdomain")
  public ResponseEntity<?> create(@RequestBody(required = false) Map<String, Object> body) {
    Map<String, Object> request = body == null ? Map.of() : body;
    if (!caller.isAdmin(str(request.get("session_token")))) {
      return ResponseEntity.status(403).body(
          Map.of("error", "Only admins can create subdomains"));
    }

    String challengeId = str(request.get("challenge_id"));
    String rawSlug = str(request.get("slug"));
    String hostingMode = str(request.get("hosting_mode"));

    if (challengeId == null) {
      return ResponseEntity.status(400).body(Map.of("error", "challenge_id is required"));
    }
    if (rawSlug == null) {
      return ResponseEntity.status(400).body(Map.of("error", "slug is required"));
    }
    if (hostingMode == null || !HOSTING_MODES.contains(hostingMode)) {
      return ResponseEntity.status(400).body(
          Map.of("error", "hosting_mode must be wildcard or separate_subdomain"));
    }

    SubdomainValidation.Result validation = SubdomainValidation.validateSlug(rawSlug);
    if (!validation.valid()) {
      return ResponseEntity.status(400).body(Map.of("error", validation.error()));
    }
    String slug = validation.normalized();

    String baseDomain = plesk.baseDomain();
    if (baseDomain.isEmpty()) {
      return ResponseEntity.status(500).body(
          Map.of("error", "PLESK_BASE_DOMAIN is not configured"));
    }
    String fullDomain = slug + "." + baseDomain;

    List<ChallengeDomainEntity> existing = domains.findByHost(fullDomain);
    if (existing.stream().anyMatch(d -> BLOCKING_STATUSES.contains(nz(d.getStatus())))) {
      return ResponseEntity.status(409).body(
          Map.of("error", "A subdomain with this slug already exists"));
    }
    // Earlier failed attempts on the same slug are retired, so the table shows
    // one live row per slug while keeping the history.
    for (ChallengeDomainEntity failed : existing) {
      if ("failed".equals(nz(failed.getStatus()))) {
        failed.setStatus("deleted");
        failed.setUpdatedDate(Instant.now());
        domains.save(failed);
      }
    }

    Optional<ChallengeEntity> challenge = challenges.findById(challengeId);
    if (challenge.isEmpty()) {
      return ResponseEntity.status(404).body(Map.of("error", "Challenge not found"));
    }

    boolean separate = "separate_subdomain".equals(hostingMode);

    // Checked before anything is written. A clash found afterwards would mean
    // deciding whether to delete a subdomain that might not be ours.
    if (separate && plesk.isConfigured() && plesk.lookupDomain(fullDomain).isPresent()) {
      return ResponseEntity.status(409).body(Map.of("error",
          "This subdomain already exists in Plesk. "
              + "Choose a different slug or delete it from Plesk first."));
    }

    Instant now = Instant.now();
    ChallengeDomainEntity record = new ChallengeDomainEntity();
    record.setId(newId());
    record.setChallengeId(challengeId);
    record.setChallengeName(nz(challenge.get().getTitle()));
    record.setSlug(slug);
    record.setBaseDomain(baseDomain);
    record.setFullDomain(fullDomain);
    record.setFullUrl("https://" + fullDomain);
    record.setStatus("provisioning");
    record.setHostingMode(hostingMode);
    record.setGitLocation(orEmpty(str(request.get("git_location"))));
    record.setGitDeploymentStatus(
        str(request.get("git_location")) == null ? "skipped" : "pending");
    // Only a legacy URL is recorded here. PEM text posted by the admin UI is
    // written to private storage inside installCertificate, and the reference
    // it returns replaces these — the key material must not be held in the
    // request any longer than it takes to store it.
    record.setSslCertUrl(orEmpty(str(request.get("ssl_cert_url"))));
    record.setSslKeyUrl(orEmpty(str(request.get("ssl_key_url"))));
    record.setSslStatus(
        str(request.get("ssl_cert_url")) == null && str(request.get("ssl_certificate")) == null
            ? "skipped" : "pending");
    record.setCreatedDate(now);
    record.setUpdatedDate(now);
    record.setIsSample(false);
    domains.save(record);

    // Wildcard DNS already resolves *.baseDomain, so there is nothing to do.
    if (!separate) {
      record.setStatus("active");
      record.setUpdatedDate(Instant.now());
      domains.save(record);
      return ResponseEntity.ok(Map.of("ok", true, "domain", toJson(record)));
    }

    if (!plesk.isConfigured()) {
      return fail(record, plesk.missingConfiguration(), 500);
    }

    PleskProvisioning.Provisioned result = provisioning.createSubdomain(slug);
    if (!result.success()) {
      return fail(record, orDefault(result.error(), "Plesk API failed"), 502);
    }

    record.setStatus("active");
    record.setPleskSiteId(orEmpty(result.siteId()));
    record.setDocumentRoot(orEmpty(result.documentRoot()));

    // Both of these are best-effort. The subdomain exists and is usable
    // either way, so a failure is recorded against the record rather than
    // failing a provision that otherwise worked.
    String gitLocation = str(request.get("git_location"));
    if (gitLocation != null) {
      PleskShellOps.ShellResult cloned = shell.cloneGit(
          gitLocation, result.documentRoot(), result.siteId());
      record.setGitDeploymentStatus(cloned.success() ? "deployed" : "failed");
      if (!cloned.success()) {
        record.setErrorMessage(cloned.error());
      }
    }

    // Either PEM text (the admin UI posts the file contents) or a legacy URL.
    boolean hasCertificate = str(request.get("ssl_certificate")) != null
        || str(request.get("ssl_cert_url")) != null;
    if (hasCertificate) {
      PleskShellOps.ShellResult installed =
          installCertificate(record, request, fullDomain, result.siteId());
      record.setSslStatus(installed.success() ? "installed" : "failed");
      if (!installed.success()) {
        record.setErrorMessage(installed.error());
      }
    }

    record.setUpdatedDate(Instant.now());
    domains.save(record);

    Map<String, Object> out = new LinkedHashMap<>();
    out.put("ok", true);
    out.put("domain", toJson(record));
    if (result.alreadyExisted()) {
      out.put("warning", "The subdomain already existed in Plesk and was reused.");
    }
    return ResponseEntity.ok(out);
  }

  /**
   * Installs the certificate, from PEM text or from a URL.
   *
   * <p><b>Text is the supported path.</b> The admin UI reads the files in the
   * browser and posts their contents, so the private key travels once, to this
   * server, and is written to {@link PrivateFileStore} — owner-read-only,
   * outside any document root. It is never uploaded anywhere that serves
   * files.
   *
   * <p>The URL path remains for records created before that change, whose keys
   * are already stored elsewhere. Only {@code https://} is accepted: this
   * server sits inside the network, and a {@code file://} or
   * {@code http://localhost} URL here would read local files or reach internal
   * services that are not otherwise exposed.
   */
  private PleskShellOps.ShellResult installCertificate(
      ChallengeDomainEntity record, Map<String, Object> request,
      String fullDomain, String siteId) {

    String certificateText = str(request.get("ssl_certificate"));
    String keyText = str(request.get("ssl_private_key"));

    try {
      String certificate;
      String key;

      if (certificateText != null) {
        certificate = certificateText;
        key = keyText == null ? "" : keyText;

        if (!files.isConfigured()) {
          return PleskShellOps.ShellResult.failed(
              "Private file storage is not configured. Set PRIVATE_FILES_DIR.");
        }
        // Stored before installing: if Plesk rejects the certificate, the
        // material is still here to retry with rather than lost with the
        // request.
        record.setSslCertUrl(files.write("cert-" + fullDomain, certificate));
        if (!key.isBlank()) {
          record.setSslKeyUrl(files.write("key-" + fullDomain, key));
        }
      } else {
        certificate = fetchPem(str(request.get("ssl_cert_url")));
        String keyUrl = str(request.get("ssl_key_url"));
        key = keyUrl == null ? "" : fetchPem(keyUrl);
      }

      return shell.installCertificate(fullDomain, certificate, key, siteId);
    } catch (PrivateFileStore.StorageException e) {
      return PleskShellOps.ShellResult.failed(e.getMessage());
    } catch (IllegalArgumentException e) {
      return PleskShellOps.ShellResult.failed(e.getMessage());
    } catch (Exception e) {
      // The exception, never the material it was handling.
      log.warn("Could not prepare certificate material for {}: {}", fullDomain, e.toString());
      return PleskShellOps.ShellResult.failed(
          "Could not read the SSL certificate that was supplied.");
    }
  }

  private String fetchPem(String url) throws Exception {
    URI uri = URI.create(url);
    if (!"https".equalsIgnoreCase(uri.getScheme())) {
      throw new IllegalArgumentException(
          "Certificate URLs must use https:// — refusing to fetch " + uri.getScheme() + "://");
    }
    HttpRequest request = HttpRequest.newBuilder(uri)
        .timeout(Duration.ofSeconds(20))
        .GET()
        .build();
    HttpResponse<String> response = HttpClient.newBuilder()
        .connectTimeout(Duration.ofSeconds(10))
        .followRedirects(HttpClient.Redirect.NEVER)
        .build()
        .send(request, HttpResponse.BodyHandlers.ofString());
    if (response.statusCode() >= 400) {
      throw new IllegalArgumentException(
          "The certificate URL returned HTTP " + response.statusCode());
    }
    return response.body();
  }

  private ResponseEntity<?> fail(ChallengeDomainEntity record, String message, int status) {
    record.setStatus("failed");
    record.setErrorMessage(message);
    record.setUpdatedDate(Instant.now());
    domains.save(record);
    return ResponseEntity.status(status).body(Map.of("error", message));
  }

  // -------------------------------------------------------------- delete

  @PostMapping("/api/apps/{appId}/functions/deleteChallengeSubdomain")
  public ResponseEntity<?> delete(@RequestBody(required = false) Map<String, Object> body) {
    Map<String, Object> request = body == null ? Map.of() : body;
    if (!caller.isAdmin(str(request.get("session_token")))) {
      return ResponseEntity.status(403).body(
          Map.of("error", "Only admins can delete subdomains"));
    }

    String domainId = str(request.get("domain_id"));
    if (domainId == null) {
      return ResponseEntity.status(400).body(Map.of("error", "domain_id is required"));
    }
    Optional<ChallengeDomainEntity> found = domains.findById(domainId);
    if (found.isEmpty()) {
      return ResponseEntity.status(404).body(Map.of("error", "Domain record not found"));
    }
    ChallengeDomainEntity record = found.get();
    if ("deleted".equals(nz(record.getStatus()))) {
      return ResponseEntity.status(400).body(Map.of("error", "Domain already deleted"));
    }

    String mode = nz(record.getHostingMode());
    boolean needsTeardown =
        ("separate_subdomain".equals(mode) || "full_domain".equals(mode))
            && NEEDS_TEARDOWN.contains(nz(record.getStatus()));

    String warning = null;
    if (needsTeardown && plesk.isConfigured()) {
      PleskProvisioning.Provisioned result = "full_domain".equals(mode)
          ? provisioning.deleteFullDomain(nz(record.getFullDomain()))
          : provisioning.deleteSubdomain(nz(record.getSlug()));

      if (!result.success()) {
        // Still retired. A row left active for a subdomain that may or may not
        // exist in Plesk is worse than a retired one with the reason attached.
        warning = orDefault(result.error(), "unknown error");
        record.setErrorMessage("Plesk delete warning: " + warning);
      }
    }

    record.setStatus("deleted");
    record.setUpdatedDate(Instant.now());
    domains.save(record);

    Map<String, Object> out = new LinkedHashMap<>();
    out.put("ok", true);
    if (warning != null) {
      out.put("warning", warning);
    }
    return ResponseEntity.ok(out);
  }

  // -------------------------------------------------------------- shapes

  private static Map<String, Object> toJson(ChallengeDomainEntity d) {
    Map<String, Object> out = new LinkedHashMap<>();
    out.put("id", d.getId());
    out.put("challenge_id", d.getChallengeId());
    out.put("challenge_name", d.getChallengeName());
    out.put("slug", d.getSlug());
    out.put("base_domain", d.getBaseDomain());
    out.put("full_domain", d.getFullDomain());
    out.put("full_url", d.getFullUrl());
    out.put("status", d.getStatus());
    out.put("hosting_mode", d.getHostingMode());
    out.put("git_location", d.getGitLocation());
    out.put("git_deployment_status", d.getGitDeploymentStatus());
    // A stored certificate is reported as present, not located. Since the
    // material moved into private storage this field holds a server path, and
    // handing that to a browser tells an attacker exactly where the key lives.
    String certificate = d.getSslCertUrl();
    out.put("ssl_cert_url",
        certificate != null && certificate.startsWith("https://") ? certificate : "");
    out.put("ssl_certificate_stored", certificate != null && !certificate.isBlank());
    out.put("ssl_status", d.getSslStatus());
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
