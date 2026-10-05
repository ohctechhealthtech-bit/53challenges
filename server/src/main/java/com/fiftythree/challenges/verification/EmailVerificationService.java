package com.fiftythree.challenges.verification;

import com.fasterxml.jackson.databind.JsonNode;
import com.fiftythree.challenges.entity.EmailVerificationEntity;
import com.fiftythree.challenges.upstream.ChallengeApiClient;
import com.fiftythree.challenges.upstream.ChallengeApiClient.UpstreamResponse;
import java.util.ArrayList;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Duration;
import java.time.Instant;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.regex.Pattern;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * Email one-time codes.
 *
 * <p>Codes are sent and checked by the main 53 site's {@code emailOtp} service,
 * which is why this needs no mail server of its own. A verified token is
 * recorded here so the functions that accept submissions can require it as
 * proof and forward the same token upstream.
 */
@Service
public class EmailVerificationService {

  private static final Logger log = LoggerFactory.getLogger(EmailVerificationService.class);

  private static final Pattern EMAIL =
      Pattern.compile("^[^\\s@]+@[^\\s@]+\\.[^\\s@]{2,}$");
  private static final int CODE_LENGTH = 6;
  /** A confirmed verification is good for an hour, as it was on Base44. */
  private static final Duration TOKEN_TTL = Duration.ofHours(1);

  /** This app's purposes mapped onto the OTP service's own names. */
  private static final Map<String, String> UPSTREAM_PURPOSE = Map.of(
      "challenge_entry", "participation",
      "guardian_consent", "participation",
      "sponsor_application", "sponsor_request",
      "judge_application", "judge_request",
      "host_application", "host_request");

  private final ChallengeApiClient upstream;
  private final EmailVerificationQueryRepository repository;

  public EmailVerificationService(
      ChallengeApiClient upstream, EmailVerificationQueryRepository repository) {
    this.upstream = upstream;
    this.repository = repository;
  }

  /** Asks the OTP service to email a fresh code. */
  public Map<String, Object> send(String email, String purpose) {
    String to = norm(email);
    if (!EMAIL.matcher(to).matches()) {
      throw new IllegalArgumentException("Please enter a valid email address");
    }
    JsonNode r = callOtp(Map.of("email", to, "purpose", upstreamPurpose(purpose)));
    String error = errorOf(r);
    if (error != null) {
      throw new IllegalStateException(error);
    }
    Map<String, Object> out = new LinkedHashMap<>();
    out.put("expires_at", r.path("expires_at").asText(null));
    return out;
  }

  /**
   * Checks a code with the OTP service and, on success, records the token
   * locally.
   *
   * <p>The code itself is stored only as a SHA-256 hash. It is short-lived and
   * single-use, but it is also something a person typed from their inbox, and
   * there is no reason for the plaintext to sit in the database.
   */
  public Map<String, Object> confirm(String email, String purpose, String code) {
    String to = norm(email);
    String clean = code == null ? "" : code.trim();
    if (clean.length() != CODE_LENGTH) {
      return Map.of("error", "Please enter the 6-digit code from the email.");
    }

    JsonNode r = callOtp(Map.of(
        "action", "verify", "email", to, "purpose", upstreamPurpose(purpose), "code", clean));
    String error = errorOf(r);
    if (error != null) {
      return Map.of("error", error);
    }

    // What the OTP service says back, minus the token itself. When the same
    // token is then refused by submit_entry seconds later, the two sides
    // disagree about something, and the issuing response is the only place
    // the issuer states its own terms — purpose, expiry, whatever it names.
    List<String> fields = new ArrayList<>();
    r.fieldNames().forEachRemaining(n -> fields.add(
        "verification_token".equals(n) ? n + "=<redacted>" : n + "=" + r.path(n).asText("")));
    log.info("otp verify ok for {} purpose={} (upstream said: {})",
        to, upstreamPurpose(purpose), String.join(", ", fields));

    String token = r.path("verification_token").asText("");
    if (token.isEmpty()) {
      return Map.of("error", "That code could not be confirmed. Please request a new one.");
    }

    Instant now = Instant.now();
    EmailVerificationEntity row = new EmailVerificationEntity();
    row.setId(UUID.randomUUID().toString().replace("-", "").substring(0, 24));
    row.setEmail(to);
    row.setPurpose(purpose);
    row.setCode(sha256(clean));
    row.setToken(token);
    row.setVerified(true);
    row.setConsumed(false);
    row.setVerifiedAt(now);
    row.setExpiresAt(now.plus(TOKEN_TTL));
    row.setCreatedDate(now);
    row.setUpdatedDate(now);
    row.setIsSample(false);
    repository.save(row);

    return Map.of("success", true, "verification_token", token);
  }

  /**
   * Verifies a token WITHOUT consuming it, returning the row so the caller can
   * consume it once the work has actually succeeded.
   *
   * <p>Consuming up front is the tempting shortcut and it is wrong: if the
   * submission then fails for any other reason, the entrant is left unable to
   * retry and unable to request a new code, because their address is already
   * verified. That failure mode has been seen on this project.
   *
   * @throws IllegalStateException with a message naming the actual cause
   */
  public EmailVerificationEntity check(String email, String purpose, String token) {
    String to = norm(email);
    String tok = token == null ? "" : token.trim();
    if (tok.isEmpty()) {
      throw new IllegalStateException("Please verify your email address first.");
    }

    List<EmailVerificationEntity> rows = repository.findUsable(to, purpose, tok);
    if (!rows.isEmpty()) {
      EmailVerificationEntity row = rows.get(0);
      if (row.getExpiresAt() != null && row.getExpiresAt().isBefore(Instant.now())) {
        throw new IllegalStateException(
            "That verification has expired. Please request a new code.");
      }
      return row;
    }

    // Work out WHICH condition failed. One opaque message for five different
    // causes sends people to request a new code when the real problem is a
    // token issued for a different address — which a new code will not fix.
    List<EmailVerificationEntity> forEmail = repository.findRecentForEmail(to, purpose);
    List<EmailVerificationEntity> byToken = forEmail.stream()
        .filter(r -> tok.equals(r.getToken() == null ? "" : r.getToken().trim()))
        .toList();

    String reason;
    if (forEmail.isEmpty()) {
      reason = "no_verification_for_this_email";
    } else if (byToken.isEmpty()) {
      reason = "token_belongs_to_a_different_address";
    } else if (byToken.stream().allMatch(r -> Boolean.TRUE.equals(r.getConsumed()))) {
      reason = "token_already_used";
    } else if (byToken.stream().noneMatch(r -> Boolean.TRUE.equals(r.getVerified()))) {
      reason = "code_never_confirmed";
    } else {
      reason = "unknown";
    }

    log.info("checkEmailVerified miss: email={} purpose={} reason={} rowsForEmail={} rowsForToken={}",
        to, purpose, reason, forEmail.size(), byToken.size());

    throw new IllegalStateException(
        "Email verification could not be confirmed. Please request a new code. [" + reason + "]");
  }

  /** Marks a row from {@link #check} as used. Call only once the work succeeded. */
  public void consume(EmailVerificationEntity row) {
    if (row == null || row.getId() == null) {
      return;
    }
    row.setConsumed(true);
    row.setUpdatedDate(Instant.now());
    repository.save(row);
  }

  public boolean isKnownPurpose(String purpose) {
    return UPSTREAM_PURPOSE.containsKey(purpose);
  }

  // ------------------------------------------------------------------ plumbing

  private String upstreamPurpose(String purpose) {
    return UPSTREAM_PURPOSE.getOrDefault(purpose, purpose);
  }

  private JsonNode callOtp(Map<String, Object> payload) {
    UpstreamResponse res = upstream.postTo(upstream.sibling("emailOtp"), payload);
    JsonNode body = res.body();
    // The service answers either bare or wrapped in `data`.
    return body.path("data").isObject() ? body.path("data") : body;
  }

  /** The error message in an OTP response, or null when it succeeded. */
  private static String errorOf(JsonNode r) {
    if (r.path("ok").isBoolean() && !r.path("ok").asBoolean()) {
      return firstText(r, "OTP service reported a failure");
    }
    if (!r.path("error").isMissingNode() && !r.path("error").isNull()) {
      return firstText(r, "OTP service error");
    }
    return null;
  }

  private static String firstText(JsonNode r, String fallback) {
    JsonNode error = r.path("error");
    if (error.isObject() && error.hasNonNull("message")) {
      return error.path("message").asText();
    }
    if (error.isTextual() && !error.asText().isBlank()) {
      return error.asText();
    }
    if (r.hasNonNull("message")) {
      return r.path("message").asText();
    }
    return fallback;
  }

  private static String sha256(String value) {
    try {
      MessageDigest md = MessageDigest.getInstance("SHA-256");
      return HexFormat.of().formatHex(md.digest(value.getBytes(StandardCharsets.UTF_8)));
    } catch (Exception e) {
      // Cannot happen: SHA-256 is required of every JVM.
      throw new IllegalStateException(e);
    }
  }

  private static String norm(String v) {
    return v == null ? "" : v.trim().toLowerCase();
  }
}
