package com.fiftythree.challenges.upstream;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fiftythree.challenges.compliance.ComplianceAuditService;
import com.fiftythree.challenges.lifecycle.LifecycleGateService;
import com.fiftythree.challenges.security.CustomSessionVerifier;
import com.fiftythree.challenges.security.JwtService;
import io.jsonwebtoken.Claims;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;

/**
 * Trading a session token for a JWT.
 *
 * <p>This exists so that browsers signed in before the JWT cutover are not
 * treated as anonymous by the entity API, which would quietly filter their own
 * rows out of every list rather than fail visibly. That makes it a credential
 * issuer, and the thing it must never do is mint a JWT for a session token it
 * cannot verify.
 */
class TokenExchangeTest {

  private static final String API_KEY = "test-api-key-value";
  private static final String JWT_SECRET = "0123456789012345678901234567890123456789";

  private final ChallengeApiClient upstream = mock(ChallengeApiClient.class);
  private final CustomSessionVerifier sessions = new CustomSessionVerifier(API_KEY);
  private final JwtService jwt = new JwtService(JWT_SECRET, 3600);

  private final ChallengeApiController controller = new ChallengeApiController(
      upstream,
      mock(LifecycleGateService.class),
      mock(ComplianceAuditService.class),
      sessions,
      jwt,
      new ObjectMapper(),
      "");

  private ResponseEntity<?> exchange(Map<String, Object> request) {
    return controller.handle(request);
  }

  @SuppressWarnings("unchecked")
  private static Map<String, Object> body(ResponseEntity<?> response) {
    return (Map<String, Object>) response.getBody();
  }

  @Test
  void aValidSessionIsExchangedForAJwtCarryingTheSameIdentity() {
    String session = sessions.sign("Person@Example.com", "A Person", "uid-9");

    ResponseEntity<?> response =
        exchange(Map.of("action", "exchange_token", "session_token", session));

    assertEquals(200, response.getStatusCode().value());
    Claims claims = jwt.verify((String) body(response).get("access_token"));
    assertNotNull(claims, "the issued token must verify against the same key the filter uses");
    // Normalised on the way in, so the entity API's row filters — which match
    // on the caller's email — see the same address the session recorded.
    assertEquals("person@example.com", claims.get("email", String.class));
    assertEquals("uid-9", claims.get("uid", String.class));
    assertEquals("A Person", claims.get("name", String.class));
  }

  /**
   * The exchange must be answered here and never proxied. Forwarding it would
   * send a live session token to Base44 and return whatever that replied,
   * which is the opposite of migrating off it.
   */
  @Test
  void theExchangeNeverReachesUpstream() {
    exchange(Map.of("action", "exchange_token",
        "session_token", sessions.sign("a@b.com", "A", "1")));

    verifyNoInteractions(upstream);
  }

  @Test
  void aTamperedSessionIsRefused() {
    String session = sessions.sign("person@example.com", "A Person", "uid-9");
    String other = sessions.sign("attacker@example.com", "Someone Else", "uid-1");
    // Attacker's payload carrying the victim's signature: the forgery a stolen
    // token invites, and the one a length check or a naive decode would miss.
    String forged = other.substring(0, other.indexOf('.') + 1)
        + session.substring(session.indexOf('.') + 1);

    ResponseEntity<?> response =
        exchange(Map.of("action", "exchange_token", "session_token", forged));

    assertEquals(401, response.getStatusCode().value());
    assertNull(body(response).get("access_token"), "a forged session must mint nothing");
  }

  @Test
  void aMissingSessionIsRefused() {
    ResponseEntity<?> response = exchange(Map.of("action", "exchange_token"));

    assertEquals(401, response.getStatusCode().value());
    assertNull(body(response).get("access_token"));
  }

  @Test
  void anEmptySessionIsRefused() {
    ResponseEntity<?> response =
        exchange(Map.of("action", "exchange_token", "session_token", "   "));

    assertEquals(401, response.getStatusCode().value());
  }
}
