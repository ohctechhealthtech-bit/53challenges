package com.fiftythree.challenges.security;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.Base64;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Verifies the Base44 "custom session" token, the one this app's Challenge-API
 * login has been issuing all along.
 *
 * <p>This exists purely for the cutover. Admins already signed in are carrying
 * one of these tokens in localStorage, and the browser sends it in the request
 * body as {@code session_token}. If this API only understood its own JWT, every
 * signed-in admin would hit a 403 the moment a route moved to Java, with no
 * indication that logging out and back in would fix it. Accepting both formats
 * makes the move invisible.
 *
 * <p>The format is Base44's, reimplemented rather than designed:
 * {@code base64url(payloadJson) + "." + base64url(HMAC-SHA256(payloadB64))},
 * keyed on the literal string {@code c53-custom-session:<CHALLENGE_API_KEY>}.
 * It must match {@code base44/shared/customSession.ts} byte for byte — a
 * mismatch here does not fail loudly, it just rejects every existing session.
 *
 * <p>Once all traffic is on the Java API and users have naturally re-logged in,
 * this class and the {@code session_token} body field can go.
 */
@Component
public class CustomSessionVerifier {

  private static final Logger log = LoggerFactory.getLogger(CustomSessionVerifier.class);

  /** 30 days, matching base44/shared/customSession.ts exactly. */
  private static final long TTL_SECONDS = 30L * 24 * 60 * 60;

  private final ObjectMapper mapper = new ObjectMapper();
  private final byte[] key;

  public CustomSessionVerifier(@Value("${app.upstream.api-key}") String apiKey) {
    this.key = ("c53-custom-session:" + apiKey).getBytes(StandardCharsets.UTF_8);
  }

  /**
   * Mints a session token for a Challenge-API login.
   *
   * <p>Must produce exactly what {@code base44/shared/customSession.ts} does:
   * the same JSON field order does not matter, but the same payload fields,
   * the same base64url encoding without padding, and the same HMAC key
   * derivation all do. Tokens minted here are verified by Base44 functions
   * still running behind the fallback proxy, and tokens minted there are
   * verified by {@link #verify} — they have to interoperate in both
   * directions.
   */
  public String sign(String email, String name, String uid) {
    try {
      long exp = Instant.now().getEpochSecond() + TTL_SECONDS;
      var payload = mapper.createObjectNode();
      payload.put("email", email == null ? "" : email.toLowerCase().trim());
      payload.put("name", name == null ? "" : name);
      payload.put("uid", uid == null ? "" : uid);
      payload.put("exp", exp);

      String payloadB64 = Base64.getUrlEncoder().withoutPadding()
          .encodeToString(mapper.writeValueAsBytes(payload));

      Mac mac = Mac.getInstance("HmacSHA256");
      mac.init(new SecretKeySpec(key, "HmacSHA256"));
      String signature = Base64.getUrlEncoder().withoutPadding()
          .encodeToString(mac.doFinal(payloadB64.getBytes(StandardCharsets.UTF_8)));

      return payloadB64 + "." + signature;
    } catch (Exception e) {
      throw new IllegalStateException("Could not sign a session token", e);
    }
  }

  /** The token's payload, or null when it is absent, malformed, forged or expired. */
  public Session verify(String token) {
    if (token == null || token.isBlank()) {
      return null;
    }
    int dot = token.indexOf('.');
    if (dot <= 0 || dot == token.length() - 1) {
      return null;
    }
    String payloadB64 = token.substring(0, dot);
    String signature = token.substring(dot + 1);

    try {
      Mac mac = Mac.getInstance("HmacSHA256");
      mac.init(new SecretKeySpec(key, "HmacSHA256"));
      byte[] expected = mac.doFinal(payloadB64.getBytes(StandardCharsets.UTF_8));
      String expectedB64 = Base64.getUrlEncoder().withoutPadding().encodeToString(expected);

      // Constant-time: a length-sensitive or short-circuiting comparison leaks
      // how much of a guessed signature was right.
      if (!MessageDigest.isEqual(
          expectedB64.getBytes(StandardCharsets.UTF_8),
          signature.getBytes(StandardCharsets.UTF_8))) {
        return null;
      }

      byte[] payload = Base64.getUrlDecoder().decode(payloadB64);
      JsonNode json = mapper.readTree(payload);
      String email = json.path("email").asText("").toLowerCase().trim();
      long exp = json.path("exp").asLong(0);
      if (email.isEmpty() || exp <= 0 || Instant.now().getEpochSecond() >= exp) {
        return null;
      }
      return new Session(email, json.path("name").asText(""), json.path("uid").asText(""));
    } catch (IllegalArgumentException e) {
      // Not base64url — a malformed token, not a server problem.
      return null;
    } catch (Exception e) {
      log.warn("Custom session verification failed unexpectedly: {}", e.toString());
      return null;
    }
  }

  public record Session(String email, String name, String uid) {}
}
