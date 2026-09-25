package com.fiftythree.challenges.security;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.nio.charset.StandardCharsets;
import java.util.Base64;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.junit.jupiter.api.Test;

/**
 * Session tokens are the app's login credential, and the scheme is shared with
 * Base44 functions still running behind the fallback proxy. A mismatch here
 * does not fail loudly — it silently rejects every existing session, or mints
 * tokens the remaining Base44 functions refuse. These tests pin the format.
 */
class CustomSessionVerifierTest {

  private static final String API_KEY = "test-api-key-value";

  private final CustomSessionVerifier verifier = new CustomSessionVerifier(API_KEY);

  @Test
  void signedTokenVerifies() {
    String token = verifier.sign("Person@Example.com ", "A Person", "uid-123");
    CustomSessionVerifier.Session session = verifier.verify(token);

    assertNotNull(session, "a freshly signed token must verify");
    // The address is normalised on the way in, so a later lookup by email
    // matches regardless of how it was typed.
    assertEquals("person@example.com", session.email());
    assertEquals("A Person", session.name());
    assertEquals("uid-123", session.uid());
  }

  /**
   * The signature must be HMAC-SHA256 over the base64url payload, keyed on
   * "c53-custom-session:<apiKey>" — computed here independently rather than by
   * calling the class under test, so this fails if the scheme drifts from
   * base44/shared/customSession.ts.
   */
  @Test
  void signatureMatchesTheSharedScheme() throws Exception {
    String token = verifier.sign("a@b.com", "N", "u1");
    int dot = token.indexOf('.');
    assertTrue(dot > 0, "token must be payload.signature");

    String payloadB64 = token.substring(0, dot);
    String signature = token.substring(dot + 1);

    Mac mac = Mac.getInstance("HmacSHA256");
    mac.init(new SecretKeySpec(
        ("c53-custom-session:" + API_KEY).getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
    String expected = Base64.getUrlEncoder().withoutPadding().encodeToString(
        mac.doFinal(payloadB64.getBytes(StandardCharsets.UTF_8)));

    assertEquals(expected, signature);
  }

  @Test
  void payloadIsBase64UrlWithoutPadding() {
    String token = verifier.sign("a@b.com", "N", "u1");
    String payloadB64 = token.substring(0, token.indexOf('.'));

    assertFalse(payloadB64.contains("="), "base64url carries no padding");
    assertFalse(payloadB64.contains("+"), "base64url uses - not +");
    assertFalse(payloadB64.contains("/"), "base64url uses _ not /");

    String json = new String(Base64.getUrlDecoder().decode(payloadB64), StandardCharsets.UTF_8);
    assertTrue(json.contains("\"email\""), json);
    assertTrue(json.contains("\"exp\""), json);
  }

  /**
   * A token minted by the ORIGINAL JavaScript implementation must verify here.
   *
   * <p>This is the compatibility that matters most: every signed-in user is
   * carrying a token Base44 minted, and if Java cannot read them the whole
   * user base is silently logged out at cutover. Generated with the exact
   * algorithm in base44/shared/customSession.ts, keyed on API_KEY, and pasted
   * in verbatim — regenerating it with Java would defeat the point.
   */
  @Test
  void verifiesATokenMintedByTheJavaScriptImplementation() {
    String jsToken =
        "eyJlbWFpbCI6ImpzQGV4YW1wbGUuY29tIiwibmFtZSI6IkpTIE1pbnRlZCIsInVpZCI6"
            + "ImpzLXVpZC05IiwiZXhwIjoxNzkyOTEzMzgyfQ"
            + ".cIVcB1nSADGzm2YY61hfh3F7cYZRDG095zJUT9juTy0";

    CustomSessionVerifier.Session session = verifier.verify(jsToken);

    assertNotNull(session, "a token minted by the JS implementation must verify");
    assertEquals("js@example.com", session.email());
    assertEquals("JS Minted", session.name());
    assertEquals("js-uid-9", session.uid());
  }

  @Test
  void aTamperedPayloadIsRejected() {
    String token = verifier.sign("a@b.com", "N", "u1");
    String signature = token.substring(token.indexOf('.') + 1);

    // Someone swapping in their own claims keeps a valid-looking signature
    // that no longer matches the payload.
    String forged = Base64.getUrlEncoder().withoutPadding().encodeToString(
        ("{\"email\":\"attacker@example.com\",\"name\":\"\",\"uid\":\"\",\"exp\":"
            + (System.currentTimeMillis() / 1000 + 3600) + "}")
            .getBytes(StandardCharsets.UTF_8));

    assertNull(verifier.verify(forged + "." + signature));
  }

  @Test
  void aTokenSignedWithAnotherKeyIsRejected() {
    String foreign = new CustomSessionVerifier("a-different-key").sign("a@b.com", "N", "u1");
    assertNull(verifier.verify(foreign));
  }

  @Test
  void malformedTokensAreRejectedNotThrown() {
    assertNull(verifier.verify(null));
    assertNull(verifier.verify(""));
    assertNull(verifier.verify("no-dot-here"));
    assertNull(verifier.verify("."));
    assertNull(verifier.verify("only-payload."));
    assertNull(verifier.verify(".only-signature"));
    assertNull(verifier.verify("not!base64.sig"));
  }

  @Test
  void anExpiredTokenIsRejected() {
    // Built by hand, because sign() always dates tokens 30 days ahead.
    String payload = "{\"email\":\"a@b.com\",\"name\":\"\",\"uid\":\"\",\"exp\":1000000000}";
    String payloadB64 = Base64.getUrlEncoder().withoutPadding()
        .encodeToString(payload.getBytes(StandardCharsets.UTF_8));

    String signed = signWith(payloadB64);
    assertNull(verifier.verify(payloadB64 + "." + signed),
        "a token past its exp must not verify, however well signed");
  }

  private static String signWith(String payloadB64) {
    try {
      Mac mac = Mac.getInstance("HmacSHA256");
      mac.init(new SecretKeySpec(
          ("c53-custom-session:" + API_KEY).getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
      return Base64.getUrlEncoder().withoutPadding()
          .encodeToString(mac.doFinal(payloadB64.getBytes(StandardCharsets.UTF_8)));
    } catch (Exception e) {
      throw new IllegalStateException(e);
    }
  }
}
