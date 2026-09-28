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
    RateLimiter limiter = new RateLimiter(1, Duration.ofMillis(50));

    assertTrue(limiter.allow("a"));
    assertFalse(limiter.allow("a"));
    Thread.sleep(80);
    assertTrue(limiter.allow("a"), "a new window starts once the old one has passed");
  }
}
