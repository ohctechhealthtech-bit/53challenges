package com.fiftythree.challenges.plesk;

import java.security.SecureRandom;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.regex.Pattern;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/**
 * Creating and removing subdomains in Plesk.
 *
 * <p>Uses the CLI gateway rather than {@code POST /domains}, matching the
 * original and for the same reason: the REST endpoint creates a <em>top-level
 * domain</em> and demands full hosting settings — IP, service plan, FTP login
 * — none of which apply to a subdomain that should live under the existing
 * subscription. {@code subdomain --create} does exactly the right thing with
 * three arguments.
 */
@Service
public class PleskProvisioning {

  private static final Logger log = LoggerFactory.getLogger(PleskProvisioning.class);

  private static final String DEFAULT_WWW_ROOT = "httpdocs";

  private final PleskClient plesk;
  private final String configuredWwwRoot;
  private final String defaultIp;
  private final String servicePlan;
  private final String parentWebspace;

  private static final SecureRandom RANDOM = new SecureRandom();

  public PleskProvisioning(
      PleskClient plesk,
      @Value("${app.plesk.subdomain-www-root:}") String configuredWwwRoot,
      @Value("${app.plesk.default-ip:}") String defaultIp,
      @Value("${app.plesk.service-plan:}") String servicePlan,
      @Value("${app.plesk.parent-webspace:}") String parentWebspace) {
    this.plesk = plesk;
    this.configuredWwwRoot = configuredWwwRoot == null ? "" : configuredWwwRoot.trim();
    this.defaultIp = defaultIp == null ? "" : defaultIp.trim();
    this.servicePlan = servicePlan == null ? "" : servicePlan.trim();
    this.parentWebspace = parentWebspace == null ? "" : parentWebspace.trim();
  }

  /** What a provisioning attempt produced. */
  public record Provisioned(
      boolean success,
      String siteId,
      String documentRoot,
      String fullDomain,
      boolean alreadyExisted,
      String error) {

    static Provisioned failed(String error) {
      return new Provisioned(false, "", "", "", false, error);
    }
  }

  /**
   * Creates a subdomain under the base domain.
   *
   * <p>The document root is the fiddly part. Plesk treats {@code -www-root}
   * as <b>relative to the subscription home</b>, not to the document root, so
   * passing an absolute path produces a doubled path and a confusing error.
   * The parent's {@code www_root} is looked up and only its last component
   * used, which also means the subdomain serves from the same folder as the
   * main site — which is what the wildcard setup already does.
   */
  public Provisioned createSubdomain(String slug) {
    if (!plesk.isConfigured()) {
      return Provisioned.failed(plesk.missingConfiguration());
    }
    String fullDomain = slug + "." + plesk.baseDomain();

    Optional<PleskClient.Domain> parent = plesk.lookupDomain(plesk.baseDomain());
    String parentWwwRoot = parent.map(PleskClient.Domain::wwwRoot).orElse("");
    String relativeWwwRoot = relativeWwwRoot(parentWwwRoot);

    PleskClient.CliResult created = plesk.cli("subdomain",
        List.of("--create", slug, "-domain", plesk.baseDomain(), "-www-root", relativeWwwRoot));

    boolean alreadyExisted = false;
    if (!created.ok()) {
      // "Already exists" is recoverable and common on a retry after a partial
      // failure, so the www-root is realigned rather than the whole call
      // being treated as an error.
      if (created.error() != null
          && created.error().toLowerCase().contains("already exists")) {
        alreadyExisted = true;
        PleskClient.CliResult updated = plesk.cli("subdomain",
            List.of("--update", slug, "-domain", plesk.baseDomain(),
                "-www-root", relativeWwwRoot));
        if (!updated.ok()) {
          log.warn("Could not realign www-root for existing subdomain {}: {}",
              slug, updated.error());
        }
      } else {
        return Provisioned.failed(created.error());
      }
    }

    if (!parentWwwRoot.isEmpty()) {
      // The parent's id is returned as the site id because a subdomain shares
      // the parent's system user, and exec runs against that.
      return new Provisioned(true, parent.map(PleskClient.Domain::id).orElse(""),
          parentWwwRoot, fullDomain, alreadyExisted, null);
    }
    return new Provisioned(true, "", plesk.documentRoot(), fullDomain, alreadyExisted, null);
  }

  /**
   * The {@code -www-root} value to pass Plesk.
   *
   * <p>An explicit setting wins; an absolute one is reduced to its last
   * component because Plesk wants it relative. Otherwise the parent's folder
   * name is reused, falling back to {@code httpdocs}.
   */
  private String relativeWwwRoot(String parentWwwRoot) {
    if (!configuredWwwRoot.isEmpty() && !"/".equals(configuredWwwRoot)) {
      return configuredWwwRoot.startsWith("/")
          ? lastComponent(configuredWwwRoot)
          : configuredWwwRoot;
    }
    return parentWwwRoot.isEmpty() ? DEFAULT_WWW_ROOT : lastComponent(parentWwwRoot);
  }

  private static String lastComponent(String path) {
    String[] parts = path.split("/");
    for (int i = parts.length - 1; i >= 0; i--) {
      if (!parts[i].isBlank()) {
        return parts[i];
      }
    }
    return DEFAULT_WWW_ROOT;
  }

  /**
   * Creates a full independent domain.
   *
   * <p>Three strategies, tried in order, because which one works depends on
   * the Plesk licence and the permissions the API key has:
   *
   * <ol>
   *   <li>{@code domain --create -webspace-name} — attaches to the existing
   *       subscription, needs the fewest permissions
   *   <li>{@code site --create -webspace-name} — the same, plus hosting
   *   <li>{@code POST /domains} with full hosting settings — a separate
   *       subscription with its own FTP user
   * </ol>
   *
   * <p>Failures are mapped to named codes rather than passed through raw,
   * because "the licence does not allow another domain" and "the service plan
   * does not exist" need different actions from whoever reads them, and
   * Plesk's own wording makes them hard to tell apart.
   */
  public Provisioned createFullDomain(String fullDomain) {
    if (!plesk.isConfigured()) {
      return Provisioned.failed(plesk.missingConfiguration());
    }
    String webspace = parentWebspace.isEmpty() ? plesk.baseDomain() : parentWebspace;
    if (defaultIp.isEmpty() && webspace.isEmpty()) {
      return Provisioned.failed("CONFIG_MISSING_DEFAULT_IP: PLESK_DEFAULT_IP "
          + "(or PLESK_PARENT_WEBSPACE) is required to create independent domains.");
    }

    List<String> params = List.of("--create", fullDomain, "-webspace-name", webspace);
    PleskClient.CliResult created = plesk.cli("domain", params);
    if (!created.ok() && !alreadyExists(created.error())) {
      created = plesk.cli("site", params);
    }

    boolean existed = false;
    if (!created.ok()) {
      if (alreadyExists(created.error())) {
        existed = true;
      } else {
        return createViaRest(fullDomain);
      }
    }

    Optional<PleskClient.Domain> domain = plesk.lookupDomain(fullDomain);
    String documentRoot = domain.map(PleskClient.Domain::wwwRoot).orElse("");
    if (documentRoot.isEmpty()) {
      // Plesk's convention when the lookup has not caught up yet.
      documentRoot = plesk.lookupDomain(webspace)
          .map(d -> d.wwwRoot().replaceAll("/+$", "") + "/" + fullDomain)
          .orElse("");
    }
    return new Provisioned(true, domain.map(PleskClient.Domain::id).orElse(""),
        documentRoot, fullDomain, existed, null);
  }

  /** The REST fallback, which creates a domain with its own hosting. */
  private Provisioned createViaRest(String fullDomain) {
    Map<String, Object> body = new LinkedHashMap<>();
    body.put("name", fullDomain);
    body.put("hosting_type", "virtual");
    body.put("hosting_settings", Map.of(
        "ftp_login", ftpLogin(fullDomain),
        // Generated here and never returned. Nothing in this app uses FTP;
        // Plesk simply insists the account has a password.
        "ftp_password", strongPassword()));
    if (!defaultIp.isEmpty()) {
      body.put("ipv4", List.of(defaultIp));
    }
    if (!servicePlan.isEmpty()) {
      body.put("plan", Map.of("name", servicePlan));
    }

    PleskClient.Result result = plesk.post("/domains", body);
    if (!result.ok() && !defaultIp.isEmpty()
        && matches(result.error(), "ip address.*not available")) {
      // The configured IP is not on this server. Letting Plesk choose is
      // better than failing, since the domain shares the subscription anyway.
      body.remove("ipv4");
      result = plesk.post("/domains", body);
    }

    if (!result.ok()) {
      String error = result.error() == null ? "" : result.error();
      if (alreadyExists(error)) {
        Optional<PleskClient.Domain> existing = plesk.lookupDomain(fullDomain);
        if (existing.isPresent()) {
          return new Provisioned(true, existing.get().id(), existing.get().wwwRoot(),
              fullDomain, true, null);
        }
      }
      return Provisioned.failed(classify(error));
    }

    Optional<PleskClient.Domain> domain = plesk.lookupDomain(fullDomain);
    return new Provisioned(true, domain.map(PleskClient.Domain::id).orElse(""),
        domain.map(PleskClient.Domain::wwwRoot).orElse(""), fullDomain, false, null);
  }

  /** Turns Plesk's wording into something an operator can act on. */
  private static String classify(String error) {
    if (matches(error, "ip.*required|ip_address.*required")) {
      return "CONFIG_MISSING_DEFAULT_IP: Plesk requires a default IP address.";
    }
    if (matches(error, "plan.*not found|service plan")) {
      return "CONFIG_MISSING_PLAN: The configured service plan was not found in Plesk.";
    }
    if (matches(error, "webspace.*not found|subscription.*not found")) {
      return "CONFIG_MISSING_WEBSPACE: The configured parent webspace was not "
          + "found in Plesk.";
    }
    // Plesk error 1024 is "not available for the current licence".
    if (matches(error, "code 1024|1024|not available|permission")) {
      return "PLESK_SUBSCRIPTION_REQUIRED: The Plesk licence does not allow creating "
          + "new independent domains. Use a subdomain instead, or upgrade the licence.";
    }
    if (matches(error, "subscription.*required|limit.*exceeded")) {
      return "PLESK_SUBSCRIPTION_REQUIRED: Plesk requires a subscription to create "
          + "this domain.";
    }
    return error;
  }

  private static boolean alreadyExists(String error) {
    return matches(error, "already exists");
  }

  private static boolean matches(String value, String regex) {
    return value != null
        && Pattern.compile(regex, Pattern.CASE_INSENSITIVE).matcher(value).find();
  }

  /** A short login derived from the domain, with random characters appended. */
  private static String ftpLogin(String fullDomain) {
    String base = fullDomain.replaceAll("[^a-z0-9]", "");
    if (base.length() > 12) {
      base = base.substring(0, 12);
    }
    if (base.isEmpty()) {
      base = "domain";
    }
    return base + Long.toString(Math.abs(RANDOM.nextLong()), 36).substring(0, 4);
  }

  /**
   * A password for the FTP account Plesk insists on.
   *
   * <p>From a CSPRNG, unlike the original's {@code Math.random()}. It is never
   * shown to anyone, but a predictable password on a real FTP account that
   * can write to a document root is a way in.
   */
  private static String strongPassword() {
    String alphabet =
        "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
    StringBuilder out = new StringBuilder(20);
    for (int i = 0; i < 20; i++) {
      out.append(alphabet.charAt(RANDOM.nextInt(alphabet.length())));
    }
    return out.toString();
  }

  /** Removes a subdomain. */
  public Provisioned deleteSubdomain(String slug) {
    if (!plesk.isConfigured()) {
      return Provisioned.failed(plesk.missingConfiguration());
    }
    PleskClient.CliResult result = plesk.cli("subdomain",
        List.of("--remove", slug, "-domain", plesk.baseDomain()));
    return result.ok()
        ? new Provisioned(true, "", "", slug + "." + plesk.baseDomain(), false, null)
        : Provisioned.failed(result.error());
  }

  /** Removes a full independent domain, which lives in its own subscription. */
  public Provisioned deleteFullDomain(String fullDomain) {
    if (!plesk.isConfigured()) {
      return Provisioned.failed(plesk.missingConfiguration());
    }
    PleskClient.CliResult result = plesk.cli("site", List.of("--remove", fullDomain));
    return result.ok()
        ? new Provisioned(true, "", "", fullDomain, false, null)
        : Provisioned.failed(result.error());
  }
}
