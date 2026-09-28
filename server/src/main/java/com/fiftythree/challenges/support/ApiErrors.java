package com.fiftythree.challenges.support;

import java.util.Map;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;

/**
 * The response for a failure the caller cannot do anything about.
 *
 * <p>Controllers used to answer {@code e.getMessage()} on an unexpected
 * exception. That is written for a developer, not a caller: it carries table
 * and column names from a constraint violation, class names and paths from a
 * parse failure, and host names from a connection error — handed to whoever
 * made the request, including whoever is probing for exactly that.
 *
 * <p>The caller gets a short reference instead, and the same reference goes
 * into the log beside the stack trace, so an operator can still find the one
 * failure a person is asking about.
 */
public final class ApiErrors {

  private static final Logger log = LoggerFactory.getLogger(ApiErrors.class);

  private ApiErrors() {
  }

  /** Logs the failure in full and returns a 500 that reveals nothing. */
  public static ResponseEntity<Object> internal(Exception e) {
    String reference = UUID.randomUUID().toString().substring(0, 8);
    log.error("Unhandled failure [{}]", reference, e);
    return ResponseEntity.status(500).body(Map.of(
        "error", "Something went wrong on our side. Please try again.",
        "reference", reference));
  }
}
