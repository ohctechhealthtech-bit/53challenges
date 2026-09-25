package com.fiftythree.challenges.lifecycle;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.fiftythree.challenges.security.CallerResolver;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;

/**
 * Who may advance the challenge lifecycle.
 *
 * <p>The Base44 original authenticated nobody, so anyone who knew the URL could
 * close voting on a live competition. These tests pin the gate that replaced
 * that, including the case the gate exists for: an anonymous caller must change
 * nothing, and must not even reach the query.
 */
class LifecycleTickAuthTest {

  private static final String TOKEN = "s3cret-tick-token";

  private final NativeChallengeQueryRepository challenges =
      mock(NativeChallengeQueryRepository.class);
  private final GateEvaluator gates = mock(GateEvaluator.class);
  private final CallerResolver caller = mock(CallerResolver.class);

  private LifecycleTickController controller(String configuredToken) {
    return new LifecycleTickController(challenges, gates, caller, configuredToken);
  }

  private static int status(ResponseEntity<?> response) {
    return response.getStatusCode().value();
  }

  @Test
  void anAnonymousCallerIsRefusedAndReachesNothing() {
    when(caller.isAdmin(null)).thenReturn(false);

    ResponseEntity<?> response = controller(TOKEN).handle(null, null);

    assertEquals(401, status(response));
    // The point of the gate: refused before any challenge is even looked at.
    verifyNoInteractions(challenges, gates);
  }

  @Test
  void aWrongTickTokenIsRefused() {
    when(caller.isAdmin(null)).thenReturn(false);

    ResponseEntity<?> response = controller(TOKEN).handle(null, "not-the-token");

    assertEquals(401, status(response));
    verifyNoInteractions(challenges, gates);
  }

  /**
   * A token that is a prefix of the real one must fail. Guards the constant-time
   * comparison: a length-agnostic or short-circuiting check would let this in.
   */
  @Test
  void aPrefixOfTheTickTokenIsRefused() {
    when(caller.isAdmin(null)).thenReturn(false);

    ResponseEntity<?> response = controller(TOKEN).handle(null, "s3cret");

    assertEquals(401, status(response));
  }

  @Test
  void theSchedulerTokenIsAccepted() {
    when(challenges.findNativeByLifecycleStatuses(anyList())).thenReturn(List.of());

    ResponseEntity<?> response = controller(TOKEN).handle(null, TOKEN);

    assertEquals(200, status(response));
  }

  /** Surrounding whitespace is a header artefact, not a different secret. */
  @Test
  void theSchedulerTokenIsAcceptedWithSurroundingWhitespace() {
    when(challenges.findNativeByLifecycleStatuses(anyList())).thenReturn(List.of());

    ResponseEntity<?> response = controller(TOKEN).handle(null, "  " + TOKEN + "  ");

    assertEquals(200, status(response));
  }

  @Test
  void anAdminSessionIsAcceptedWithoutAToken() {
    when(caller.isAdmin("admin-session")).thenReturn(true);
    when(challenges.findNativeByLifecycleStatuses(anyList())).thenReturn(List.of());

    ResponseEntity<?> response =
        controller(TOKEN).handle(Map.of("session_token", "admin-session"), null);

    assertEquals(200, status(response));
  }

  /**
   * With no token configured, the header must grant nothing at all — otherwise
   * an unset environment variable would silently reopen the endpoint to
   * everyone, which is the original vulnerability restored by omission.
   */
  @Test
  void anUnconfiguredTokenNeverMatches() {
    when(caller.isAdmin(null)).thenReturn(false);

    assertEquals(401, status(controller("").handle(null, "")));
    assertEquals(401, status(controller("").handle(null, "anything")));
    assertEquals(401, status(controller(null).handle(null, "")));
  }

  /** An admin can still work when no scheduler token is configured. */
  @Test
  void anAdminStillWorksWithNoTokenConfigured() {
    when(caller.isAdmin("admin-session")).thenReturn(true);
    when(challenges.findNativeByLifecycleStatuses(anyList())).thenReturn(List.of());

    ResponseEntity<?> response =
        controller("").handle(Map.of("session_token", "admin-session"), null);

    assertNotEquals(401, status(response));
  }
}
