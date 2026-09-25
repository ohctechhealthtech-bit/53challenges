package com.fiftythree.challenges.plesk;

import java.net.URI;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Slug and domain rules for challenge subdomains, ported from
 * {@code base44/shared/subdomainValidation.ts}.
 *
 * <p>{@code src/lib/subdomainValidation.js} mirrors these rules in the browser
 * for the live preview. That copy is a convenience; this one is the
 * enforcement, and every slug is revalidated here regardless of what the form
 * allowed through.
 */
public final class SubdomainValidation {

  /**
   * Hostnames that must keep pointing at platform infrastructure.
   *
   * <p>Blocking them stops an admin creating a subdomain that shadows mail,
   * DNS or the app's own entry points — {@code api.} or {@code mail.} pointed
   * at a challenge page would break the thing it shadowed, silently and
   * site-wide.
   */
  private static final Set<String> RESERVED_SLUGS = Set.of(
      "www", "api", "app", "admin", "dashboard", "portal", "login", "auth",
      "mail", "smtp", "imap", "pop", "webmail", "ftp", "ns1", "ns2", "mx",
      "cdn", "static", "assets", "media", "files", "img",
      "dev", "staging", "test", "preview", "base44",
      "my", "host", "judge", "sponsor", "guardian",
      "localhost");

  /** Owned by the platform: these go through the subdomain flow, not as full domains. */
  private static final String PLATFORM_BASE_DOMAIN = "53challenges.com";

  private static final Pattern SEPARATORS = Pattern.compile("[\\s_.]+");
  private static final Pattern NOT_DNS = Pattern.compile("[^a-z0-9-]");
  private static final Pattern EDGE_HYPHENS = Pattern.compile("^-+|-+$");
  private static final Pattern DNS_LABEL =
      Pattern.compile("^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$");
  private static final Pattern IPV4 = Pattern.compile("^\\d+\\.\\d+\\.\\d+\\.\\d+$");
  private static final Pattern URL_CHARS = Pattern.compile("[/?:#]");

  private SubdomainValidation() {}

  /** Valid, or the reason it is not. */
  public record Result(boolean valid, String error, String normalized) {

    static Result ok(String normalized) {
      return new Result(true, null, normalized);
    }

    static Result invalid(String error) {
      return new Result(false, error, null);
    }
  }

  /** Coerces free text into a DNS label, as far as that is possible. */
  public static String normaliseSlug(String slug) {
    if (slug == null) {
      return "";
    }
    String out = slug.trim().toLowerCase(Locale.ROOT);
    out = SEPARATORS.matcher(out).replaceAll("-");
    out = NOT_DNS.matcher(out).replaceAll("");
    return EDGE_HYPHENS.matcher(out).replaceAll("");
  }

  /**
   * Validates a slug, normalising first so the form's live preview and this
   * check can never disagree about the same input.
   */
  public static Result validateSlug(String slug) {
    String s = normaliseSlug(slug);
    if (s.isEmpty()) {
      return Result.invalid("Enter a slug using letters, numbers and hyphens.");
    }
    if (s.length() < 2) {
      return Result.invalid("Slug must be at least 2 characters.");
    }
    if (s.length() > 63) {
      return Result.invalid("Slug must be 63 characters or fewer.");
    }
    if (s.startsWith("xn--")) {
      return Result.invalid("\"xn--\" is reserved for internationalised domain names.");
    }
    if (RESERVED_SLUGS.contains(s)) {
      return Result.invalid("\"" + s
          + "\" is reserved and cannot be used as a challenge subdomain.");
    }
    return Result.ok(s);
  }

  /**
   * Validates an independent domain name.
   *
   * <p>Rejects protocols, paths, ports, query strings, IP addresses,
   * whitespace, localhost, and anything under the platform's own domain.
   */
  public static Result validateFullDomain(String input) {
    if (input == null || input.trim().isEmpty()) {
      return Result.invalid("Full domain name is required.");
    }
    // The original compared the lower-cased, trimmed value against the merely
    // trimmed one, so any capital letter was reported as "must not contain
    // whitespace" — a misleading refusal of a perfectly good domain. The check
    // was meant to catch surrounding whitespace, so that is what it does here.
    if (!input.equals(input.trim())) {
      return Result.invalid("Domain name must not contain leading or trailing whitespace.");
    }
    String raw = input.trim().toLowerCase(Locale.ROOT);
    if (raw.chars().anyMatch(Character::isWhitespace)) {
      return Result.invalid("Domain name must not contain whitespace.");
    }
    if (IPV4.matcher(raw).matches()) {
      return Result.invalid("IP addresses are not allowed. Use a domain name.");
    }
    if (raw.equals("localhost") || raw.endsWith(".localhost")) {
      return Result.invalid("localhost is not a valid public domain.");
    }
    if (raw.equals(PLATFORM_BASE_DOMAIN) || raw.endsWith("." + PLATFORM_BASE_DOMAIN)) {
      return Result.invalid(
          "Use the Challenge Subdomain option for *." + PLATFORM_BASE_DOMAIN + ".");
    }
    if (URL_CHARS.matcher(raw).find()) {
      return Result.invalid(
          "Enter the domain name only — no paths, ports, or query strings.");
    }

    String[] labels = raw.split("\\.");
    if (labels.length < 2) {
      return Result.invalid("Enter a fully-qualified domain (e.g. example.com).");
    }
    for (String label : labels) {
      if (label.startsWith("-") || label.endsWith("-")) {
        return Result.invalid("Domain labels cannot start or end with a hyphen.");
      }
      if (label.length() > 63) {
        return Result.invalid("Each domain label must be 63 characters or fewer.");
      }
      if (!DNS_LABEL.matcher(label).matches()) {
        return Result.invalid("\"" + label + "\" is not a valid DNS label.");
      }
    }
    return Result.ok(raw);
  }

  /** Validates a Git repository URL: HTTPS, GitHub, with a repository path. */
  public static Result validateGitUrl(String url) {
    if (url == null || url.trim().isEmpty()) {
      return Result.invalid("Git repository URL is required.");
    }
    String candidate = url.trim();
    try {
      URI parsed = URI.create(candidate);
      if (!"https".equals(parsed.getScheme())) {
        return Result.invalid("Git URL must use HTTPS (https://).");
      }
      String host = parsed.getHost();
      if (host == null || !host.contains("github.com")) {
        return Result.invalid("Git URL must point to a GitHub repository.");
      }
      String path = parsed.getPath();
      if (path == null || path.isEmpty() || "/".equals(path)) {
        return Result.invalid("Git URL must include the repository path (e.g. /org/repo).");
      }
      return Result.ok(candidate);
    } catch (Exception e) {
      return Result.invalid(
          "Enter a valid HTTPS GitHub URL (e.g. https://github.com/org/repo.git).");
    }
  }
}
