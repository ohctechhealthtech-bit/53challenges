package com.fiftythree.challenges.payments;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * A minimal Stripe client over the REST API.
 *
 * <p>Deliberately not the Stripe SDK. Three calls are needed — create a
 * payment intent, read one back, and stamp metadata onto one — and the
 * original Deno function made them with {@code fetch} against the same
 * form-encoded endpoints. Reproducing that keeps the wire behaviour identical
 * and avoids a dependency that would want upgrading in step with an API
 * version this code does not otherwise care about.
 *
 * <p>Money is handled in <b>cents, as integers</b>, throughout. No amount here
 * is ever a double.
 */
@Component
public class StripeClient {

  private static final Logger log = LoggerFactory.getLogger(StripeClient.class);

  private static final String INTENTS = "https://api.stripe.com/v1/payment_intents";

  private final HttpClient http = HttpClient.newBuilder()
      .connectTimeout(Duration.ofSeconds(10))
      .build();

  private final ObjectMapper mapper;
  private final String secretKey;
  private final String publishableKey;

  public StripeClient(
      ObjectMapper mapper,
      @Value("${app.stripe.secret-key:}") String secretKey,
      @Value("${app.stripe.publishable-key:}") String publishableKey) {
    this.mapper = mapper;
    this.secretKey = secretKey == null ? "" : secretKey.trim();
    this.publishableKey = publishableKey == null ? "" : publishableKey.trim();
  }

  /** Both keys are needed: the secret to call Stripe, the publishable for the browser. */
  public boolean isConfigured() {
    return !secretKey.isEmpty() && !publishableKey.isEmpty();
  }

  public String publishableKey() {
    return publishableKey;
  }

  /** A Stripe call that did not succeed, carrying the message Stripe gave. */
  public static class StripeException extends RuntimeException {
    private final int status;

    public StripeException(String message, int status) {
      super(message);
      this.status = status;
    }

    public int status() {
      return status;
    }
  }

  /** Creates a payment intent. {@code amountCents} is what will actually be charged. */
  public JsonNode createPaymentIntent(
      long amountCents,
      String currency,
      String receiptEmail,
      String description,
      Map<String, String> metadata) {

    Map<String, String> form = new LinkedHashMap<>();
    form.put("amount", String.valueOf(amountCents));
    form.put("currency", currency);
    form.put("automatic_payment_methods[enabled]", "true");
    if (receiptEmail != null && !receiptEmail.isBlank()) {
      form.put("receipt_email", receiptEmail);
    }
    if (description != null && !description.isBlank()) {
      form.put("description", description);
    }
    for (Map.Entry<String, String> entry : metadata.entrySet()) {
      form.put("metadata[" + entry.getKey() + "]", entry.getValue() == null ? "" : entry.getValue());
    }
    return post(INTENTS, form, "Could not start payment");
  }

  /** Reads a payment intent back, to verify it before trusting it. */
  public JsonNode getPaymentIntent(String paymentIntentId) {
    try {
      HttpRequest request = HttpRequest.newBuilder(URI.create(INTENTS + "/" + paymentIntentId))
          .timeout(Duration.ofSeconds(30))
          .header("Authorization", "Bearer " + secretKey)
          .GET()
          .build();
      return read(http.send(request, HttpResponse.BodyHandlers.ofString()),
          "Could not verify payment");
    } catch (StripeException e) {
      throw e;
    } catch (Exception e) {
      log.error("Stripe read failed: {}", e.toString());
      throw new StripeException("Could not verify payment", 502);
    }
  }

  /**
   * Marks a payment intent as spent.
   *
   * <p>Stripe metadata is the only durable place to record this that both
   * sides can see, and it is what stops one payment being redeemed for two
   * entries. A failure here must be treated as fatal by the caller, not
   * logged and ignored.
   */
  public JsonNode markMetadata(String paymentIntentId, String key, String value) {
    return post(INTENTS + "/" + paymentIntentId,
        Map.of("metadata[" + key + "]", value),
        "Could not update payment");
  }

  private JsonNode post(String url, Map<String, String> form, String fallbackMessage) {
    try {
      HttpRequest request = HttpRequest.newBuilder(URI.create(url))
          .timeout(Duration.ofSeconds(30))
          .header("Authorization", "Bearer " + secretKey)
          .header("Content-Type", "application/x-www-form-urlencoded")
          .POST(HttpRequest.BodyPublishers.ofString(encode(form)))
          .build();
      return read(http.send(request, HttpResponse.BodyHandlers.ofString()), fallbackMessage);
    } catch (StripeException e) {
      throw e;
    } catch (Exception e) {
      log.error("Stripe call to {} failed: {}", url, e.toString());
      throw new StripeException(fallbackMessage, 502);
    }
  }

  private JsonNode read(HttpResponse<String> response, String fallbackMessage) throws Exception {
    JsonNode body = mapper.readTree(response.body());
    if (response.statusCode() >= 400) {
      // Stripe's own message is safe to surface — it is written for the
      // cardholder ("Your card was declined") rather than for us.
      String message = body.path("error").path("message").asText("");
      log.warn("Stripe returned HTTP {}: {}", response.statusCode(), message);
      throw new StripeException(message.isBlank() ? fallbackMessage : message, 400);
    }
    return body;
  }

  private static String encode(Map<String, String> form) {
    StringBuilder out = new StringBuilder();
    for (Map.Entry<String, String> entry : form.entrySet()) {
      if (out.length() > 0) {
        out.append('&');
      }
      out.append(URLEncoder.encode(entry.getKey(), StandardCharsets.UTF_8))
          .append('=')
          .append(URLEncoder.encode(
              entry.getValue() == null ? "" : entry.getValue(), StandardCharsets.UTF_8));
    }
    return out.toString();
  }
}
