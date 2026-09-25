package com.fiftythree.challenges.plesk;

import com.fasterxml.jackson.databind.JsonNode;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Supplier;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/**
 * Plesk operations that need a shell on the server.
 *
 * <p>Plesk subscriptions run with {@code /bin/false} as their shell, which is
 * correct and should stay that way. A handful of operations — writing an nginx
 * include, installing a certificate — have no REST equivalent and can only be
 * done by running a command. The pattern is therefore: enable {@code /bin/bash}
 * on the subscription, do the work, and <b>always</b> put {@code /bin/false}
 * back.
 *
 * <p>{@link #withShell} exists so that restore cannot be forgotten. It is the
 * only way to run one of these, and the restore is in a finally block: a
 * subscription left with a live shell because an exception took an early return
 * is precisely the failure this class is shaped to prevent.
 */
@Service
public class PleskShellOps {

  private static final Logger log = LoggerFactory.getLogger(PleskShellOps.class);

  /** Base44's app id for the endpoint the proxy health check fetches. */
  private static final String PROXY_HEALTH_APP_ID = "6a683318ec3c2cc96e77b420";

  private final HttpClient http = HttpClient.newBuilder()
      .connectTimeout(Duration.ofSeconds(10))
      .followRedirects(HttpClient.Redirect.NEVER)
      .build();

  private final PleskClient plesk;
  private final String apiProxyTarget;
  private final String apiFallbackTarget;

  public PleskShellOps(
      PleskClient plesk,
      @Value("${app.plesk.api-proxy-target:http://127.0.0.1:8081}") String apiProxyTarget,
      @Value("${app.plesk.api-fallback-target:https://base44.app}") String apiFallbackTarget) {
    this.plesk = plesk;
    this.apiProxyTarget = apiProxyTarget == null || apiProxyTarget.isBlank()
        ? "http://127.0.0.1:8081"
        : apiProxyTarget.trim();
    this.apiFallbackTarget = apiFallbackTarget == null || apiFallbackTarget.isBlank()
        ? "https://base44.app"
        : apiFallbackTarget.trim();
  }

  /** The outcome of a shell-backed operation. */
  public record ShellResult(boolean success, String method, String error, String output) {

    static ShellResult failed(String error) {
      return new ShellResult(false, "failed", error, "");
    }
  }

  /**
   * Runs {@code work} with a shell enabled on the base subscription, and
   * restores {@code /bin/false} afterwards whatever happens.
   */
  private ShellResult withShell(Supplier<ShellResult> work) {
    PleskClient.CliResult enabled = plesk.cli("subscription",
        List.of("--update", plesk.baseDomain(), "-shell", "/bin/bash"));
    if (!enabled.ok()) {
      return ShellResult.failed("Could not enable shell access: " + enabled.error());
    }
    try {
      return work.get();
    } finally {
      PleskClient.CliResult restored = plesk.cli("subscription",
          List.of("--update", plesk.baseDomain(), "-shell", "/bin/false"));
      if (!restored.ok()) {
        // Loud, because the subscription is now sitting with a usable shell
        // and no further code will notice.
        log.error("FAILED TO RESTORE /bin/false on {} — the subscription still has "
            + "shell access and needs manual attention: {}",
            plesk.baseDomain(), restored.error());
      }
    }
  }

  /** Runs a command on a domain via the exec API, with the output it produced. */
  private ShellResult exec(String domainId, String command, String marker, String method) {
    PleskClient.Result result = plesk.post("/domains/" + domainId + "/exec",
        Map.of("command", List.of("bash", "-c", command)));
    if (!result.ok()) {
      return ShellResult.failed(result.error());
    }
    JsonNode data = result.data();
    String stdout = data == null ? "" : data.path("stdout").asText("").trim();
    if (marker != null && !stdout.contains(marker)) {
      return new ShellResult(false, "failed",
          stdout.isEmpty() ? "The command produced no output" : stdout, stdout);
    }
    return new ShellResult(true, method, null, stdout);
  }

  // ------------------------------------------------------- reverse proxy


  /**
   * The nginx directives a challenge subdomain needs.
   *
   * <p>Mirrors the apex: this app serves what it has ported, and everything
   * else still reaches Base44. Sending all of {@code /api/} here would break
   * the SDK's platform calls — {@code /api/apps/public/...} and
   * {@code /api/apps/auth/...} have no route in this application and would
   * 404.
   *
   * <p>Exactly one {@code location /api/} block, deliberately. Two in the same
   * server context is an nginx configuration error, and the reconfigure that
   * follows a provision fails outright rather than degrading.
   *
   * <p>The app id is a wildcard rather than pinned, so a subdomain provisioned
   * before the app id changes does not silently stop working.
   */
  String proxyDirectives() {
    return """
        location ~ ^/api/apps/[^/]+/(functions|entities)/ {
            proxy_pass %s;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_http_version 1.1;
            proxy_redirect off;
            proxy_read_timeout 90s;
        }

        location /api/ {
            proxy_pass %s;
            proxy_set_header Host base44.app;
            proxy_ssl_server_name on;
            proxy_ssl_name base44.app;
            proxy_ssl_protocols TLSv1.2 TLSv1.3;
            proxy_http_version 1.1;
            proxy_redirect off;
            proxy_read_timeout 60s;
        }
        """.formatted(apiProxyTarget, apiFallbackTarget);
  }
  /**
   * Writes the {@code /api/} reverse-proxy include for a subdomain.
   *
   * <p><b>The proxy target has changed from the original.</b> It pointed at
   * {@code https://base44.app}, which was right before this migration and is
   * wrong now: a subdomain configured that way sends its API traffic straight
   * past this application, so none of the ported functions serve it and the
   * subdomain behaves differently from the apex. It now points at
   * {@code app.plesk.api-proxy-target}, defaulting to the local app, which is
   * where the apex already sends {@code /api/}.
   *
   * <p>A failed write is not a failed provision. The subscription's system
   * user often lacks write access to the vhost conf directory, in which case
   * a root-level Plesk task applies the directives instead — so
   * {@link #checkProxyHealth} is the source of truth, not this.
   */
  public ShellResult setupReverseProxy(String fullDomain) {
    if (!plesk.isConfigured()) {
      return ShellResult.failed(plesk.missingConfiguration());
    }
    Optional<PleskClient.Domain> parent = plesk.lookupDomain(plesk.baseDomain());
    if (parent.isEmpty() || parent.get().id().isEmpty()) {
      return ShellResult.failed("Awaiting server-side nginx sync");
    }

    String directives = proxyDirectives();

    String confPath = "/var/www/vhosts/system/" + fullDomain + "/conf/vhost_nginx.conf";
    // Base64 so the directives survive shell quoting intact — they contain
    // braces, dollars and newlines, all of which bash would otherwise eat.
    String encoded = Base64.getEncoder()
        .encodeToString(directives.getBytes(StandardCharsets.UTF_8));

    String command = "echo '" + encoded + "' | base64 -d > " + confPath + " 2>&1"
        + " && /usr/local/psa/admin/bin/httpdmng --reconfigure-domain " + fullDomain + " 2>&1"
        + " && echo WRITTEN";

    return withShell(() -> {
      ShellResult written = exec(parent.get().id(), command, "WRITTEN", "vhost-nginx");
      return written.success()
          ? written
          : ShellResult.failed("Awaiting server-side nginx sync");
    });
  }

  // ---------------------------------------------------------- git deploy

  /**
   * Clones a repository into a domain's document root.
   *
   * <p><b>The URL is validated and quoted before it reaches a shell.</b> The
   * original interpolated it straight into a {@code bash -c} string, and
   * {@code createChallengeSubdomain} passed it through unvalidated — so a
   * semicolon in that form field ran as a command on the server. Admin-only,
   * but that turns one compromised admin account into a compromised host.
   *
   * <p>A failure here is reported, not thrown: the subdomain exists either way
   * and the host can deploy by SFTP.
   */
  public ShellResult cloneGit(String gitUrl, String documentRoot, String domainId) {
    if (!plesk.isConfigured()) {
      return ShellResult.failed(plesk.missingConfiguration());
    }
    SubdomainValidation.Result validation = SubdomainValidation.validateGitUrl(gitUrl);
    if (!validation.valid()) {
      return ShellResult.failed(validation.error());
    }
    if (documentRoot == null || documentRoot.isBlank()) {
      // Guarded explicitly: the command below removes the directory contents,
      // and an empty root would make that "rm -rf /*".
      return ShellResult.failed("Could not determine the document root for this domain");
    }
    if (domainId == null || domainId.isBlank()) {
      return ShellResult.failed("Could not find the Plesk domain ID for this domain");
    }

    String url = shellQuote(validation.normalized());
    String root = shellQuote(documentRoot);
    String command = "rm -rf " + root + "/* " + root + "/.[!.]* 2>/dev/null; "
        + "cd " + root + " && git clone --depth 1 " + url + " . && echo CLONED";

    return withShell(() -> {
      ShellResult cloned = exec(domainId, command, "CLONED", "exec");
      return cloned.success() ? cloned : ShellResult.failed(
          "Git clone failed: " + cloned.error()
              + ". Please deploy the repository manually via SFTP or Plesk File Manager.");
    });
  }

  // ------------------------------------------------------------- ssl

  /**
   * Installs a certificate on a domain.
   *
   * <p>Accepts a separate key, or one PEM containing both — several
   * authorities issue them that way and people upload the same file twice.
   * Both are base64-encoded on the way to the server so the PEM survives shell
   * quoting, and the temporary files are removed whether the install worked or
   * not: a private key left in {@code /tmp} is readable by anything on the box.
   */
  public ShellResult installCertificate(
      String fullDomain, String certificate, String privateKey, String domainId) {

    if (!plesk.isConfigured()) {
      return ShellResult.failed(plesk.missingConfiguration());
    }

    String cert = certificate == null ? "" : certificate;
    String key = privateKey == null ? "" : privateKey;
    if (key.isBlank() && !cert.isBlank()) {
      Matcher embedded = PRIVATE_KEY_BLOCK.matcher(cert);
      if (embedded.find()) {
        key = embedded.group();
        cert = cert.replace(key, "").trim();
      }
    }
    if (cert.isBlank() || key.isBlank()) {
      return ShellResult.failed(
          "SSL certificate or private key not found. Please provide both the "
              + "certificate (.pem/.crt) and the private key (.key), or a single "
              + "PEM file containing both.");
    }

    String id = domainId;
    if (id == null || id.isBlank()) {
      id = plesk.lookupDomain(plesk.baseDomain())
          .map(PleskClient.Domain::id)
          .orElse("");
    }
    if (id.isBlank()) {
      return ShellResult.failed("Could not find the parent domain for SSL installation");
    }

    String name = "ssl-" + fullDomain.replace('.', '-');
    String certPath = "/tmp/" + name + ".crt";
    String keyPath = "/tmp/" + name + ".key";
    String certB64 = Base64.getEncoder()
        .encodeToString(cert.getBytes(StandardCharsets.UTF_8));
    String keyB64 = Base64.getEncoder()
        .encodeToString(key.getBytes(StandardCharsets.UTF_8));

    String command = "echo '" + certB64 + "' | base64 -d > " + certPath + " && "
        + "echo '" + keyB64 + "' | base64 -d > " + keyPath + " && "
        + "chmod 600 " + certPath + " " + keyPath + " && "
        + "/usr/local/psa/bin/certificate --create " + shellQuote(name)
        + " -domain " + shellQuote(fullDomain)
        + " -cert-file " + certPath + " -key-file " + keyPath + " && echo INSTALLED; "
        // Removed in the same command whatever happened above, so a failed
        // install does not leave the key sitting in /tmp.
        + "rm -f " + certPath + " " + keyPath;

    String finalId = id;
    return withShell(() -> exec(finalId, command, "INSTALLED", "certificate"));
  }

  private static final Pattern PRIVATE_KEY_BLOCK = Pattern.compile(
      "-----BEGIN (?:RSA )?PRIVATE KEY-----[\\s\\S]*?-----END (?:RSA )?PRIVATE KEY-----");

  /**
   * Wraps a value in single quotes for bash, escaping any it contains.
   *
   * <p>Inside single quotes bash treats everything literally, so the only
   * character needing care is the quote itself — closed, escaped, reopened.
   */
  private static String shellQuote(String value) {
    return "'" + value.replace("'", "'\\''") + "'";
  }

  /** Whether the domain's {@code /api/} proxy is actually serving. */
  public ProxyHealth checkProxyHealth(String fullDomain) {
    String url = "https://" + fullDomain
        + "/api/apps/public/prod/public-settings/by-id/" + PROXY_HEALTH_APP_ID;
    try {
      HttpRequest request = HttpRequest.newBuilder(URI.create(url))
          .timeout(Duration.ofSeconds(15))
          .header("Accept", "application/json")
          .GET()
          .build();
      HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString());

      // A 200 is not enough. A misconfigured proxy happily serves the SPA's
      // index.html with a 200, and treating that as healthy would report a
      // broken subdomain as working.
      boolean json = response.headers().firstValue("content-type")
          .map(type -> type.contains("application/json"))
          .orElse(false);
      return new ProxyHealth(response.statusCode() == 200 && json, response.statusCode());
    } catch (Exception e) {
      return new ProxyHealth(false, 0);
    }
  }

  /** Whether the proxy answered, and with what. */
  public record ProxyHealth(boolean healthy, int statusCode) {}
}
