package com.fiftythree.challenges.payments;

import com.fasterxml.jackson.databind.JsonNode;
import com.fiftythree.challenges.entry.EntryFeeService;
import com.fiftythree.challenges.entity.ChallengeEntity;
import com.fiftythree.challenges.entity.ChallengeRepository;
import com.fiftythree.challenges.guardian.GuardianConsentQueryRepository;
import com.fiftythree.challenges.security.CallerResolver;
import com.fiftythree.challenges.support.JsonColumn;
import com.fiftythree.challenges.upstream.ChallengeApiClient;
import com.fiftythree.challenges.user.UserRepository;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/**
 * The Java replacement for {@code challengeFunds}: entry fees for paid
 * challenges.
 *
 * <p>This handles money taken from the public, so the rules below are not
 * defensive style — each one closes a way of entering a paid competition
 * without paying for it, or of paying once and entering twice.
 *
 * <ul>
 *   <li><b>The fee is derived server-side, always.</b> Any {@code amount} in
 *       the request is ignored outright.
 *   <li><b>The entrant is the signed-in account.</b> A {@code creator_email}
 *       naming somebody else is refused, not quietly overwritten.
 *   <li><b>The payment is verified with Stripe</b> before an entry exists, and
 *       must belong to this user, this challenge, and match the expected fee.
 *   <li><b>The payment is burned before the entry is recorded.</b> Metadata is
 *       stamped first, so a crash between the two loses an entry rather than
 *       creating one that can be made again for free.
 *   <li><b>The kids freeze is checked before burning</b>, so a blocked child's
 *       entry does not cost their parent the fee.
 * </ul>
 *
 * <p>Entries for paid challenges are created only after Stripe confirms.
 */
@RestController
public class ChallengeFundsController {

  private static final Logger log = LoggerFactory.getLogger(ChallengeFundsController.class);

  private static final Set<String> CHILD_DIVISIONS = Set.of("children", "teens");

  /** Below this, Stripe will not take a card payment anyway. */
  private static final long MINIMUM_CHARGE_CENTS = 100;

  /** The metadata flag marking a payment as already redeemed. */
  private static final String BURNED = "entry_recorded";

  private final StripeClient stripe;
  private final EntryFeeService fees;
  private final ChallengeRepository challenges;
  private final GuardianConsentQueryRepository consents;
  private final ChallengeApiClient upstream;
  private final CallerResolver caller;
  private final UserRepository users;
  private final JsonColumn json;

  public ChallengeFundsController(
      StripeClient stripe,
      EntryFeeService fees,
      ChallengeRepository challenges,
      GuardianConsentQueryRepository consents,
      ChallengeApiClient upstream,
      CallerResolver caller,
      UserRepository users,
      JsonColumn json) {
    this.stripe = stripe;
    this.fees = fees;
    this.challenges = challenges;
    this.consents = consents;
    this.upstream = upstream;
    this.caller = caller;
    this.users = users;
    this.json = json;
  }

  @PostMapping("/api/apps/{appId}/functions/challengeFunds")
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
    String userId = users.findIdByEmail(email).orElse("");

    try {
      return switch (orEmpty(str(request.get("action")))) {
        case "create_intent" -> createIntent(request, email, userId);
        case "record_entry_payment" -> recordPayment(request, email, userId);
        default -> ResponseEntity.status(400).body(Map.of("error", "Unknown action"));
      };
    } catch (StripeClient.StripeException e) {
      return ResponseEntity.status(e.status()).body(Map.of("error", e.getMessage()));
    } catch (Exception e) {
      log.error("challengeFunds failed", e);
      return ResponseEntity.status(500).body(Map.of(
          "error", e.getMessage() == null ? "Payment request failed" : e.getMessage()));
    }
  }

  // --------------------------------------------------------- create intent

  private ResponseEntity<?> createIntent(
      Map<String, Object> request, String email, String userId) {

    String challengeId = orEmpty(str(request.get("challenge_id")));
    String divisionId = orEmpty(str(request.get("division_id")));

    long amount;
    try {
      // Derived from the challenge record. Whatever the browser sent as
      // 'amount' never reaches Stripe.
      amount = fees.feeCents(challengeId, divisionId);
    } catch (Exception e) {
      return ResponseEntity.status(400).body(Map.of(
          "error", e.getMessage() == null ? "Could not read the entry fee" : e.getMessage()));
    }
    if (amount < MINIMUM_CHARGE_CENTS) {
      return ResponseEntity.status(400).body(Map.of(
          "error", "This challenge does not have a payable entry fee."));
    }

    if (kidsFrozen(challengeId, divisionId, false)) {
      return ResponseEntity.status(403).body(Map.of("error", KIDS_FROZEN_MESSAGE));
    }

    Map<String, String> metadata = new LinkedHashMap<>();
    metadata.put("challenge_id", challengeId);
    metadata.put("division_id", divisionId);
    metadata.put("email", email);
    metadata.put("user_id", userId);

    JsonNode intent = stripe.createPaymentIntent(amount, "aud", null, null, metadata);

    Map<String, Object> out = new LinkedHashMap<>();
    out.put("client_secret", intent.path("client_secret").asText(""));
    out.put("payment_intent_id", intent.path("id").asText(""));
    out.put("publishable_key", stripe.publishableKey());
    return ResponseEntity.ok(out);
  }

  // --------------------------------------------------------- record payment

  private ResponseEntity<?> recordPayment(
      Map<String, Object> request, String email, String userId) {

    String paymentIntentId = str(request.get("payment_intent_id"));
    if (!(request.get("entry") instanceof Map<?, ?> rawEntry)) {
      return ResponseEntity.status(400).body(Map.of("error", "Missing payment or entry details"));
    }
    Map<String, Object> entry = new LinkedHashMap<>(castMap(rawEntry));
    String challengeId = orEmpty(str(entry.get("challenge_id")));

    if (paymentIntentId == null
        || challengeId.isEmpty()
        || str(entry.get("title")) == null
        || str(entry.get("work_url")) == null) {
      return ResponseEntity.status(400).body(Map.of("error", "Missing payment or entry details"));
    }

    // The entrant is the session, full stop. A claimed address belonging to
    // somebody else is refused rather than silently corrected, because a
    // mismatch means the client is confused about who is signed in.
    String claimed = orEmpty(str(entry.get("creator_email"))).toLowerCase(Locale.ROOT).trim();
    String sessionEmail = email.toLowerCase(Locale.ROOT).trim();
    if (!claimed.isEmpty() && !claimed.equals(sessionEmail)) {
      return ResponseEntity.status(403).body(Map.of(
          "error", "Entries must be submitted from your own signed-in account."));
    }
    entry.put("creator_email", sessionEmail);
    entry.put("user_id", sessionEmail);

    JsonNode intent = stripe.getPaymentIntent(paymentIntentId);
    if (!"succeeded".equals(intent.path("status").asText(""))) {
      return ResponseEntity.status(402).body(Map.of("error", "Payment has not succeeded"));
    }

    JsonNode metadata = intent.path("metadata");
    if (!userId.equals(metadata.path("user_id").asText(""))) {
      return ResponseEntity.status(403).body(Map.of(
          "error", "This payment does not belong to your account."));
    }
    if (!challengeId.equals(metadata.path("challenge_id").asText(""))) {
      return ResponseEntity.status(403).body(Map.of(
          "error", "This payment was not made for this challenge."));
    }
    if ("1".equals(metadata.path(BURNED).asText(""))) {
      return ResponseEntity.status(409).body(Map.of(
          "error", "This payment has already been used to record an entry."));
    }

    // The amount actually received must equal the fee this challenge charges,
    // recomputed now rather than trusted from when the intent was created.
    long expected;
    try {
      expected = fees.feeCents(challengeId, orEmpty(str(entry.get("division_id"))));
    } catch (Exception e) {
      return ResponseEntity.status(402).body(Map.of(
          "error", "Paid amount does not match this challenge's entry fee."));
    }
    long paid = intent.has("amount_received") && !intent.path("amount_received").isNull()
        ? intent.path("amount_received").asLong()
        : intent.path("amount").asLong();
    if (paid != expected) {
      return ResponseEntity.status(402).body(Map.of(
          "error", "Paid amount does not match this challenge's entry fee."));
    }

    // Checked before the payment is burned, so a refused child's entry leaves
    // the fee re-usable rather than consumed.
    if (kidsFrozen(challengeId, divisionOf(entry), isMinor(entry))) {
      return ResponseEntity.status(403).body(Map.of("error", KIDS_FROZEN_MESSAGE));
    }

    if (isExcluded(sessionEmail)) {
      return ResponseEntity.status(403).body(Map.of(
          "error", "This email cannot enter this season"));
    }
    if (hasAlreadyEntered(challengeId, sessionEmail)) {
      return ResponseEntity.status(409).body(Map.of(
          "error", "This email has already entered this challenge"));
    }

    // Burn first. If this fails the entry is not recorded, which is the right
    // way round: a lost entry can be resubmitted, a re-usable payment cannot
    // be un-spent.
    try {
      stripe.markMetadata(paymentIntentId, BURNED, "1");
    } catch (StripeClient.StripeException e) {
      log.error("Could not burn payment intent {}: {}", paymentIntentId, e.getMessage());
      return ResponseEntity.status(502).body(Map.of(
          "error", "Could not secure this payment against re-use — entry not recorded."));
    }

    JsonNode result = upstream.post("submit_entry", Map.of("entry", entry));
    String error = result.path("error").asText("");
    if (!error.isBlank()) {
      return ResponseEntity.status(400).body(Map.of("error", error));
    }
    if (result.has("success") && !result.path("success").asBoolean(true)) {
      return ResponseEntity.status(400).body(Map.of("error", "Submission rejected"));
    }

    Map<String, Object> out = new LinkedHashMap<>();
    out.put("success", true);
    out.put("entry", result.has("entry") ? result.path("entry") : result);
    return ResponseEntity.ok(out);
  }

  // --------------------------------------------------------------- guards

  private static final String KIDS_FROZEN_MESSAGE =
      "Entries for children and teens are not open yet. "
          + "A parent or guardian must complete consent first.";

  /**
   * Whether this entry is caught by the kids freeze.
   *
   * <p>Frozen when the division is a child one, when the entrant is a minor,
   * or when the <em>challenge</em> has any child division at all — and no
   * guardian consent record exists anywhere yet. The last condition is what
   * lifts the freeze once the consent flow goes live.
   */
  private boolean kidsFrozen(String challengeId, String divisionId, boolean minor) {
    boolean kids = minor || CHILD_DIVISIONS.contains(
        orEmpty(divisionId).toLowerCase(Locale.ROOT).trim());

    if (!kids) {
      ChallengeEntity challenge = challengeId.isEmpty()
          ? null : challenges.findById(challengeId).orElse(null);
      if (challenge != null) {
        kids = json.stringList(challenge.getDivisions()).stream()
            .anyMatch(d -> d != null
                && CHILD_DIVISIONS.contains(d.toLowerCase(Locale.ROOT).trim()));
      }
    }
    return kids && !consents.anyExists();
  }

  private static String divisionOf(Map<String, Object> entry) {
    String division = str(entry.get("division_id"));
    return division != null ? division : orEmpty(str(entry.get("division")));
  }

  /** A minor by their own flag, by a derived age, or by the division they entered. */
  private static boolean isMinor(Map<String, Object> entry) {
    if (Boolean.TRUE.equals(entry.get("is_minor"))) {
      return true;
    }
    Object age = entry.get("derived_age");
    if (age != null) {
      try {
        if (Double.parseDouble(String.valueOf(age)) < 18) {
          return true;
        }
      } catch (NumberFormatException e) {
        // Not a number: tells us nothing either way, so fall through to the
        // division check rather than treating it as an adult.
      }
    }
    return CHILD_DIVISIONS.contains(divisionOf(entry).toLowerCase(Locale.ROOT).trim());
  }

  /**
   * Whether this address is excluded from the season.
   *
   * <p>Always false today, matching {@code exclusionGuard}: no exclusion
   * source is maintained yet, so every address is eligible. Kept as a call
   * rather than deleted because the original runs this check here, and when a
   * banned-account list does exist this is where it has to be consulted —
   * before the payment is burned, so a refused entrant keeps their fee.
   *
   * <p>Wire it to the same source {@code exclusionGuard} uses when one exists,
   * so the two cannot disagree.
   */
  private boolean isExcluded(String email) {
    return false;
  }

  /** Upstream rejects duplicates itself; this is the earlier, friendlier check. */
  private boolean hasAlreadyEntered(String challengeId, String email) {
    try {
      JsonNode result = upstream.post("check_email",
          Map.of("challenge_id", challengeId, "email", email));
      return result.path("duplicate").asBoolean(false)
          || result.path("exists").asBoolean(false)
          || result.path("already_entered").asBoolean(false);
    } catch (Exception e) {
      log.warn("Duplicate check unavailable for {}: {}", challengeId, e.toString());
      return false;
    }
  }

  // -------------------------------------------------------------- helpers

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
