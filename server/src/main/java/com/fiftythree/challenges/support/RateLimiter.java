package com.fiftythree.challenges.support;

import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * A fixed-window attempt counter, keyed by whatever the caller chooses.
 *
 * <p>In memory, so it resets on restart and counts per instance. That is
 * stated plainly rather than implied: it raises the cost of guessing
 * passwords or flooding a form from trivial to slow, which is what these
 * endpoints need, and it is not a substitute for a shared limiter if this
 * ever runs behind more than one process.
 *
 * <p>The map is bounded, so the limiter cannot itself become the way to
 * exhaust memory — the thing it exists to prevent.
 */
public final class RateLimiter {

  private static final int MAX_KEYS = 10_000;

  private final int maxPerWindow;
  private final Duration window;

  private final Map<String, Window> seen = new LinkedHashMap<>() {
    @Override
    protected boolean removeEldestEntry(Map.Entry<String, Window> eldest) {
      return size() > MAX_KEYS;
    }
  };

  private record Window(Instant start, int count) {}

  public RateLimiter(int maxPerWindow, Duration window) {
    this.maxPerWindow = maxPerWindow;
    this.window = window;
  }

  /**
   * Records an attempt and says whether it is allowed.
   *
   * @param key what to count by — an address, an email, whatever identifies
   *     the source well enough to be worth limiting
   */
  public synchronized boolean allow(String key) {
    Instant now = Instant.now();
    Window current = seen.get(key);
    if (current == null || current.start().isBefore(now.minus(window))) {
      seen.put(key, new Window(now, 1));
      return true;
    }
    if (current.count() >= maxPerWindow) {
      return false;
    }
    seen.put(key, new Window(current.start(), current.count() + 1));
    return true;
  }

  /** Forgets a key, so a success does not count against a later attempt. */
  public synchronized void clear(String key) {
    seen.remove(key);
  }
}
