package com.fiftythree.challenges.support;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Duration;
import org.junit.jupiter.api.Test;

/** The counter behind login and contact-form throttling. */
class RateLimiterTest {

  @Test
  void allowsUpToTheLimitThenRefuses() {
    RateLimiter limiter = new RateLimiter(3, Duration.ofHours(1));

    assertTrue(limiter.allow("a"));
    assertTrue(limiter.allow("a"));
    assertTrue(limiter.allow("a"));
    assertFalse(limiter.allow("a"), "the fourth attempt in the window is refused");
  }

  @Test
  void keysAreCountedSeparately() {
    RateLimiter limiter = new RateLimiter(1, Duration.ofHours(1));

    assertTrue(limiter.allow("a"));
    assertFalse(limiter.allow("a"));
    // One caller exhausting their allowance must not lock out everyone else.
    assertTrue(limiter.allow("b"));
  }

  /** A successful sign-in should not leave the account part-way to locked. */
  @Test
  void clearingAKeyRestoresItsAllowance() {
    RateLimiter limiter = new RateLimiter(2, Duration.ofHours(1));

    limiter.allow("a");
    limiter.allow("a");
    assertFalse(limiter.allow("a"));

    limiter.clear("a");
    assertTrue(limiter.allow("a"));
  }

  @Test
  void aWindowThatHasPassedStartsAgain() throws Exception {
    // 500ms, not 50. The two calls below are consecutive and should both fall
    // inside one window, but under load — a build downloading dependencies,
    // say — 50ms elapsed between them and the second opened a new window.
    // The test then failed for a reason that had nothing to do with the
    // limiter. A window wide enough to survive a slow machine tests the same
    // behaviour and only fails when the behaviour is wrong.
    RateLimiter limiter = new RateLimiter(1, Duration.ofMillis(500));

    assertTrue(limiter.allow("a"));
    assertFalse(limiter.allow("a"));
    Thread.sleep(700);
    assertTrue(limiter.allow("a"), "a new window starts once the old one has passed");
  }
}
