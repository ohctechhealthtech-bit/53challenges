package com.fiftythree.challenges.judging;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.fiftythree.challenges.entity.JudgingPanelRepository;
import com.fiftythree.challenges.security.CallerResolver;
import com.fiftythree.challenges.support.JsonColumn;
import com.fiftythree.challenges.vote.VoteRepository;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;

/**
 * Who may compute and lock a competition's combined results.
 *
 * <p>This endpoint deletes every existing result for a challenge, rewrites
 * them, and with {@code lock:true} sets {@code results_locked} — it decides who
 * won, and the lock cannot be undone. The Base44 original authenticated nobody,
 * so any anonymous caller could rewrite an outcome.
 */
class CombinedResultsAuthTest {

  private final JudgingPanelRepository panels = mock(JudgingPanelRepository.class);
  private final ScoreQueryRepository scores = mock(ScoreQueryRepository.class);
  private final CombinedResultQueryRepository results = mock(CombinedResultQueryRepository.class);
  private final VoteRepository votes = mock(VoteRepository.class);
  private final CallerResolver caller = mock(CallerResolver.class);

  private final CombinedResultsController controller = new CombinedResultsController(
      panels, scores, results, votes, mock(JsonColumn.class), caller);

  private static int status(ResponseEntity<?> response) {
    return response.getStatusCode().value();
  }

  @Test
  void anAnonymousCallerIsRefusedAndNothingIsTouched() {
    when(caller.email(null)).thenReturn(null);

    ResponseEntity<?> response = controller.handle(Map.of("panel_id", "p1", "lock", true));

    assertEquals(401, status(response));
    // Refused before the panel is even loaded: no read, no delete, no lock.
    verifyNoInteractions(panels, results, scores, votes);
  }

  @Test
  void aSignedInNonAdminIsRefused() {
    when(caller.email("user-session")).thenReturn("user@example.com");
    when(caller.isAdmin("user-session")).thenReturn(false);

    ResponseEntity<?> response =
        controller.handle(Map.of("panel_id", "p1", "session_token", "user-session"));

    assertEquals(403, status(response));
    verifyNoInteractions(panels, results, scores, votes);
  }

  /**
   * An admin gets past the gate. The panel does not exist here, so a 404 is
   * the correct next answer — what matters is that it is no longer 401 or 403.
   */
  @Test
  void anAdminPassesTheGate() {
    when(caller.email("admin-session")).thenReturn("admin@example.com");
    when(caller.isAdmin("admin-session")).thenReturn(true);
    when(panels.findById("p1")).thenReturn(java.util.Optional.empty());

    ResponseEntity<?> response =
        controller.handle(Map.of("panel_id", "p1", "session_token", "admin-session"));

    assertEquals(404, status(response));
  }

  /**
   * The gate runs before the panel_id check, so a caller cannot learn whether
   * an endpoint exists, or probe it, without credentials.
   */
  @Test
  void authorisationIsCheckedBeforeInputValidation() {
    when(caller.email(null)).thenReturn(null);

    assertEquals(401, status(controller.handle(Map.of())));
    assertEquals(401, status(controller.handle(null)));
  }
}
