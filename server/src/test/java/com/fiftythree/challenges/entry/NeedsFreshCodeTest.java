package com.fiftythree.challenges.entry;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.lang.reflect.Method;
import org.junit.jupiter.api.Test;

/**
 * Which upstream refusals send the entrant back for a new code.
 *
 * <p>This used to match only on "verif", which caught one of the OTP
 * service's phrasings and missed the other two. An entrant whose token had
 * expired or been spent kept it in the browser, kept seeing a green "Email
 * verified" above a red error, and resent the same dead token on every retry.
 *
 * <p>The other half matters as much: a refusal for a closed challenge or a
 * duplicate entry must not clear a perfectly good token. Sending someone to
 * fetch a code they do not need is its own dead end.
 */
class NeedsFreshCodeTest {

  private static boolean needsFreshCode(String message) throws Exception {
    Method m = SubmitChallengeEntryController.class
        .getDeclaredMethod("needsFreshCode", String.class);
    m.setAccessible(true);
    return (boolean) m.invoke(null, message);
  }

  @Test
  void theOtpServicesOwnRefusalsAllAskForANewCode() throws Exception {
    assertTrue(needsFreshCode("Email verification required — verify your email with the code we sent."));
    assertTrue(needsFreshCode("That verification has expired. Please request a new code."));
    assertTrue(needsFreshCode("This code has already been used."));
    assertTrue(needsFreshCode("verification failed"));
  }

  @Test
  void aRefusalAboutTheEntryItselfLeavesTheTokenAlone() throws Exception {
    assertFalse(needsFreshCode("This challenge is not open for entries."));
    assertFalse(needsFreshCode("You have already entered this challenge."));
    assertFalse(needsFreshCode("Submission rejected"));
  }

  @Test
  void nothingAtAllIsNotAReasonToReverify() throws Exception {
    assertFalse(needsFreshCode(null));
    assertFalse(needsFreshCode(""));
  }
}
