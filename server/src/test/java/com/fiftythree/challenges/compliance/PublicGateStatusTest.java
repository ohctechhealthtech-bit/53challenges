package com.fiftythree.challenges.compliance;

import static org.junit.jupiter.api.Assertions.assertTrue;

import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;

/**
 * The gate status lookup has to answer without a session.
 *
 * <p>A challenge page asks for it to decide whether to show Enter and Vote,
 * and those pages are public — a challenge subdomain exists so that anyone
 * can open it. The session check used to sit above this branch, so a
 * logged-out visitor got 401, the client failed closed as designed, and every
 * challenge rendered as "Entries &amp; voting are paused pending review" no
 * matter how open it was. Nobody signed in ever saw it.
 *
 * <p>An ordering property, so the test reads the order.
 */
class PublicGateStatusTest {

  private static final Path SOURCE = Path.of(
      "src/main/java/com/fiftythree/challenges/compliance/ComplianceGateController.java");

  @Test
  void statusesIsAnsweredBeforeTheSessionIsRequired() throws Exception {
    String source = Files.readString(SOURCE);
    int statuses = source.indexOf("if (\"statuses\".equals(action))");
    int unauthorised = source.indexOf("if (email == null)");

    assertTrue(statuses > 0, "the statuses branch is gone");
    assertTrue(unauthorised > 0, "the session check is gone");
    assertTrue(statuses < unauthorised,
        "the session check now runs before the statuses branch, so a logged-out"
            + " visitor gets 401 and every challenge shows as paused");
  }
}
