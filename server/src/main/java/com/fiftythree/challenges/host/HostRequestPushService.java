package com.fiftythree.challenges.host;

import com.fasterxml.jackson.databind.JsonNode;
import com.fiftythree.challenges.upstream.ChallengeApiClient;
import com.fiftythree.challenges.upstream.ChallengeApiClient.UpstreamResponse;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * Pushes a host application to the main app, and tells it when the card has
 * been charged. A port of {@code base44/shared/hostRequestPush.ts}.
 *
 * <p>The main app owns proposals and invoices; this app takes the payment. The
 * two have to agree about the amount, which is why the Stripe payment intent
 * and the exact cents charged are forwarded with the application — without
 * them the parent prices the invoice from its own rate card, the totals
 * diverge, and the confirmation is rejected as a mismatch.
 */
@Service
public class HostRequestPushService {

  private static final Logger log = LoggerFactory.getLogger(HostRequestPushService.class);

  /** Backoff for the confirmation, in milliseconds. */
  private static final List<Long> RETRY_DELAYS = List.of(0L, 1500L, 3000L);

  private final ChallengeApiClient upstream;

  public HostRequestPushService(ChallengeApiClient upstream) {
    this.upstream = upstream;
  }

  /** What the parent gave back for an application. */
  public record PushResult(String requestId, String invoiceId, long amount, JsonNode price) {}

  /** Raised when the parent would not accept the application. */
  public static class PushFailedException extends RuntimeException {
    public PushFailedException(String message) {
      super(message);
    }
  }

  /**
   * Sends an application to the parent's {@code guest_apply}.
   *
   * @param paymentIntentId the Stripe intent already charged here, if any
   * @param paymentAmountCents what was actually charged, so the parent's
   *     invoice matches the real payment rather than its own pricing
   */
  public PushResult push(
      Map<String, Object> answers, String paymentIntentId, long paymentAmountCents) {

    String email = firstNonBlank(
        str(answers.get("host_email")), str(answers.get("contact_email")))
        .toLowerCase(Locale.ROOT);
    String contactName = firstNonBlank(
        str(answers.get("contact_name")), str(answers.get("name")));
    String phone = firstNonBlank(
        str(answers.get("contact_phone")), str(answers.get("phone")));

    // The parent refuses a blank organisation with "Please tell us who this
    // challenge is for", so it falls back through the names we do have rather
    // than failing an application over a field an individual host has no
    // answer to.
    String organisation = firstNonBlank(
        str(answers.get("organisation_name")),
        str(answers.get("org_name")),
        str(answers.get("contact_name")),
        str(answers.get("beneficiary_name")),
        "Individual host");

    Map<String, Object> payload = new LinkedHashMap<>();
    payload.put("action", "guest_apply");
    payload.put("email", email);
    payload.put("contact_name", contactName);
    payload.put("phone", phone);
    payload.put("organisation_name", organisation);
    payload.put("answers", answers);

    String savedQuote = str(answers.get("saved_quote_id"));
    if (!savedQuote.isBlank()) {
      payload.put("saved_quote_id", savedQuote);
    }
    if (paymentIntentId != null && !paymentIntentId.isBlank()) {
      payload.put("payment_intent_id", paymentIntentId);
    }
    if (paymentAmountCents > 0) {
      payload.put("payment_amount", paymentAmountCents);
    }

    UpstreamResponse response;
    try {
      response = upstream.postTo(upstream.sibling("hostPortal"), payload);
    } catch (Exception e) {
      throw new PushFailedException(
          "Could not reach the main 53 Challenges app: " + e.getMessage());
    }

    JsonNode data = response.body();
    if (response.status() >= 400) {
      throw new PushFailedException(firstNonBlank(data.path("error").asText(""),
          "The main app rejected this application (" + response.status() + ")."));
    }

    String requestId = firstNonBlank(
        data.path("proposal_id").asText(""),
        data.path("request_id").asText(""),
        data.path("id").asText(""));
    if (requestId.isBlank()) {
      throw new PushFailedException(firstNonBlank(data.path("error").asText(""),
          "The main app did not confirm this application."));
    }

    return new PushResult(requestId, data.path("invoice_id").asText(""),
        data.path("amount").asLong(0),
        data.has("price") ? data.path("price") : null);
  }

  /**
   * Tells the parent the card has been charged, so its invoice moves to paid.
   *
   * <p><b>Best-effort by design.</b> By the time this runs the money has left
   * the host's account, so a failure here must not be reported as a failed
   * payment — an admin reconciles from Stripe instead. It retries only on a
   * 404, because the parent creates the invoice moments earlier and its
   * database is eventually consistent; every other error is permanent and
   * retrying would only delay the answer.
   */
  public boolean confirmPayment(String invoiceId, String paymentIntentId, String email) {
    if (isBlank(invoiceId) || isBlank(paymentIntentId)) {
      log.warn("Cannot confirm a host payment without both an invoice and an intent");
      return false;
    }

    Map<String, Object> payload = new LinkedHashMap<>();
    payload.put("action", "guest_confirm_payment");
    payload.put("invoice_id", invoiceId);
    payload.put("payment_intent_id", paymentIntentId);
    payload.put("email", email == null ? "" : email);

    String lastError = "";
    for (long delay : RETRY_DELAYS) {
      if (delay > 0) {
        try {
          Thread.sleep(delay);
        } catch (InterruptedException e) {
          Thread.currentThread().interrupt();
          break;
        }
      }
      try {
        UpstreamResponse response =
            upstream.postTo(upstream.sibling("hostPortal"), payload);
        if (response.status() < 400) {
          return true;
        }
        lastError = firstNonBlank(response.body().path("error").asText(""),
            "HTTP " + response.status());
        if (response.status() != 404) {
          break;
        }
      } catch (Exception e) {
        lastError = e.getMessage() == null ? e.toString() : e.getMessage();
      }
    }

    // Logged loudly: the host has paid and the parent does not know, which
    // needs a person to reconcile.
    log.error("Host payment confirmed here but NOT on the main app. "
        + "Invoice {}, intent {}: {}", invoiceId, paymentIntentId, lastError);
    return false;
  }

  private static boolean isBlank(String value) {
    return value == null || value.isBlank();
  }

  private static String firstNonBlank(String... values) {
    for (String value : values) {
      if (value != null && !value.isBlank()) {
        return value;
      }
    }
    return "";
  }

  private static String str(Object value) {
    return value == null ? "" : String.valueOf(value).trim();
  }
}
