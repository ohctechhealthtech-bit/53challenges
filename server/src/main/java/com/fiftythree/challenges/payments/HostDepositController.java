package com.fiftythree.challenges.payments;

import com.fasterxml.jackson.databind.JsonNode;
import com.fiftythree.challenges.security.CallerResolver;
import com.fiftythree.challenges.user.UserRepository;
import java.util.LinkedHashMap;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/**
 * The Java replacement for {@code hostDepositCheckout}: the deposit a host
 * pays to have a challenge run for them.
 *
 * <p>The amounts are fixed in code rather than read from the request, which is
 * the whole security model here — a host cannot choose what their deposit
 * costs. A delivery level with no deposit is refused rather than defaulted,
 * so adding a new package without pricing it fails loudly instead of billing
 * zero.
 */
@RestController
public class HostDepositController {

  private static final Logger log = LoggerFactory.getLogger(HostDepositController.class);

  /** The deposit per package, in cents. */
  private record Deposit(long amountCents, String label) {}

  private static final Map<String, Deposit> DEPOSITS = Map.of(
      "supported",
      new Deposit(14900, "Challenge hosting deposit — Supported package"),
      "fully_managed",
      new Deposit(29900, "Challenge hosting deposit — Fully managed package"));

  private final StripeClient stripe;
  private final CallerResolver caller;
  private final UserRepository users;

  public HostDepositController(
      StripeClient stripe, CallerResolver caller, UserRepository users) {
    this.stripe = stripe;
    this.caller = caller;
    this.users = users;
  }

  @PostMapping("/api/apps/{appId}/functions/hostDepositCheckout")
  public ResponseEntity<?> handle(@RequestBody(required = false) Map<String, Object> body) {
    Map<String, Object> request = body == null ? Map.of() : body;
    String sessionToken = str(request.get("session_token"));
    String email = caller.email(sessionToken);
    if (email == null) {
      return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
    }
    if (!stripe.isConfigured()) {
      return ResponseEntity.status(500).body(Map.of("error", "Stripe keys not configured"));
    }

    Map<String, Object> proposal = request.get("proposal_data") instanceof Map<?, ?> supplied
        ? castMap(supplied)
        : Map.of();

    Deposit deposit = DEPOSITS.get(orEmpty(str(proposal.get("delivery_level"))));
    if (deposit == null) {
      return ResponseEntity.status(400).body(Map.of(
          "error", "No deposit required for this package"));
    }

    String challengeTitle = clip(orEmpty(str(proposal.get("challenge_title"))), 200);
    String userId = users.findIdByEmail(email).orElse("");

    Map<String, String> metadata = new LinkedHashMap<>();
    metadata.put("user_id", userId);
    metadata.put("delivery_level", orEmpty(str(proposal.get("delivery_level"))));
    metadata.put("challenge_title", challengeTitle);

    try {
      JsonNode intent = stripe.createPaymentIntent(
          deposit.amountCents(),
          "aud",
          email,
          deposit.label() + " — "
              + (challengeTitle.isEmpty() ? "Your challenge" : challengeTitle),
          metadata);

      Map<String, Object> out = new LinkedHashMap<>();
      out.put("client_secret", intent.path("client_secret").asText(""));
      out.put("payment_intent_id", intent.path("id").asText(""));
      out.put("amount", deposit.amountCents());
      out.put("label", deposit.label());
      out.put("publishable_key", stripe.publishableKey());
      return ResponseEntity.ok(out);
    } catch (StripeClient.StripeException e) {
      return ResponseEntity.status(e.status()).body(Map.of("error", e.getMessage()));
    } catch (Exception e) {
      log.error("hostDepositCheckout failed", e);
      return ResponseEntity.status(500).body(Map.of(
          "error", e.getMessage() == null ? "Could not start payment" : e.getMessage()));
    }
  }

  private static String clip(String value, int max) {
    return value.length() <= max ? value : value.substring(0, max);
  }

  @SuppressWarnings("unchecked")
  private static Map<String, Object> castMap(Map<?, ?> supplied) {
    return (Map<String, Object>) supplied;
  }

  private static String orEmpty(String value) {
    return value == null ? "" : value;
  }

  private static String str(Object value) {
    if (value == null) {
      return null;
    }
    String text = String.valueOf(value).trim();
    return text.isEmpty() ? null : text;
  }
}
