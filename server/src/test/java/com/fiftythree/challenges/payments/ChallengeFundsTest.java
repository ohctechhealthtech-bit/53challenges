package com.fiftythree.challenges.payments;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fiftythree.challenges.entity.ChallengeRepository;
import com.fiftythree.challenges.entry.EntryFeeService;
import com.fiftythree.challenges.guardian.GuardianConsentQueryRepository;
import com.fiftythree.challenges.security.CallerResolver;
import com.fiftythree.challenges.support.JsonColumn;
import com.fiftythree.challenges.upstream.ChallengeApiClient;
import com.fiftythree.challenges.user.UserRepository;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.http.ResponseEntity;

/**
 * Entry fees are real money taken from the public, and every test here is a
 * way of entering a paid competition without paying properly: choosing your
 * own price, spending somebody else's payment, spending one payment twice, or
 * paying the wrong challenge's fee.
 *
 * <p>The ordering tests matter as much as the refusals. Burning the payment
 * before recording the entry, and checking the kids freeze before burning, are
 * both choices about which way round to fail — and neither shows up as a bug
 * until it costs somebody a fee.
 */
class ChallengeFundsTest {

  private static final String EMAIL = "alice@example.com";
  private static final String USER_ID = "user-alice";
  private static final String CHALLENGE = "ch-1";

  private final ObjectMapper mapper = new ObjectMapper();

  private StripeClient stripe;
  private EntryFeeService fees;
  private ChallengeRepository challenges;
  private GuardianConsentQueryRepository consents;
  private ChallengeApiClient upstream;

  private ChallengeFundsController controller;

  @BeforeEach
  void setUp() {
    stripe = mock(StripeClient.class);
    fees = mock(EntryFeeService.class);
    challenges = mock(ChallengeRepository.class);
    consents = mock(GuardianConsentQueryRepository.class);
    upstream = mock(ChallengeApiClient.class);
    CallerResolver caller = mock(CallerResolver.class);
    UserRepository users = mock(UserRepository.class);

    when(stripe.isConfigured()).thenReturn(true);
    when(stripe.publishableKey()).thenReturn("pk_test_123");
    when(caller.email(any())).thenReturn(EMAIL);
    when(users.findIdByEmail(EMAIL)).thenReturn(Optional.of(USER_ID));
    when(challenges.findById(anyString())).thenReturn(Optional.empty());
    // Consent records exist, so the kids freeze is lifted unless a test says
    // otherwise.
    when(consents.anyExists()).thenReturn(true);
    when(fees.feeCents(anyString(), anyString())).thenReturn(2500L);
    when(upstream.post(anyString(), any())).thenReturn(mapper.createObjectNode());

    controller = new ChallengeFundsController(stripe, fees, challenges, consents,
        upstream, caller, users, new JsonColumn(mapper));
  }

  // --------------------------------------------------------- create intent

  @Test
  void theFeeComesFromTheChallengeNotFromTheBrowser() {
    // The attack this closes: posting amount=1 to enter a $25 competition for
    // a cent.
    when(stripe.createPaymentIntent(anyLong(), anyString(), any(), any(), any()))
        .thenReturn(intent("pi_1", "requires_payment_method", 2500, Map.of()));

    controller.handle(Map.of(
        "action", "create_intent", "challenge_id", CHALLENGE, "amount", 1));

    ArgumentCaptor<Long> charged = ArgumentCaptor.forClass(Long.class);
    verify(stripe).createPaymentIntent(charged.capture(), eq("aud"), any(), any(), any());
    assertEquals(2500L, charged.getValue(), "the server-derived fee, not the posted one");
  }

  @Test
  void aChallengeWithNoPayableFeeIsRefused() {
    // Below Stripe's minimum charge, so an intent would fail anyway — better
    // to say why than to pass it on.
    when(fees.feeCents(anyString(), anyString())).thenReturn(0L);

    ResponseEntity<?> response = controller.handle(Map.of(
        "action", "create_intent", "challenge_id", CHALLENGE));

    assertEquals(400, response.getStatusCode().value());
    verify(stripe, never()).createPaymentIntent(anyLong(), any(), any(), any(), any());
  }

  @Test
  void aChildsPaymentDoesNotStartWhileTheKidsFreezeHolds() {
    when(consents.anyExists()).thenReturn(false);

    ResponseEntity<?> response = controller.handle(Map.of(
        "action", "create_intent", "challenge_id", CHALLENGE, "division_id", "children"));

    assertEquals(403, response.getStatusCode().value());
    verify(stripe, never()).createPaymentIntent(anyLong(), any(), any(), any(), any());
  }

  // ---------------------------------------------------------------- record

  @Test
  void aPaymentBelongingToAnotherAccountIsRefused() {
    // Someone else's payment intent id, replayed. The metadata is the only
    // thing tying a payment to a person.
    stubIntent(intent("pi_1", "succeeded", 2500,
        Map.of("user_id", "user-bob", "challenge_id", CHALLENGE)));

    ResponseEntity<?> response = controller.handle(record("pi_1", entry()));

    assertEquals(403, response.getStatusCode().value());
    verifyNothingRecorded();
  }

  @Test
  void aPaymentMadeForAnotherChallengeIsRefused() {
    // Pay for the cheap competition, enter the expensive one.
    stubIntent(intent("pi_1", "succeeded", 2500,
        Map.of("user_id", USER_ID, "challenge_id", "ch-other")));

    assertEquals(403, controller.handle(record("pi_1", entry())).getStatusCode().value());
    verifyNothingRecorded();
  }

  @Test
  void anAlreadyRedeemedPaymentIsRefused() {
    stubIntent(intent("pi_1", "succeeded", 2500,
        Map.of("user_id", USER_ID, "challenge_id", CHALLENGE, "entry_recorded", "1")));

    assertEquals(409, controller.handle(record("pi_1", entry())).getStatusCode().value());
    verifyNothingRecorded();
  }

  @Test
  void anUnsucceededPaymentIsRefused() {
    stubIntent(intent("pi_1", "requires_payment_method", 2500,
        Map.of("user_id", USER_ID, "challenge_id", CHALLENGE)));

    assertEquals(402, controller.handle(record("pi_1", entry())).getStatusCode().value());
    verifyNothingRecorded();
  }

  @Test
  void payingLessThanTheFeeIsRefused() {
    // The fee could have changed since the intent was created, or the intent
    // could have been made against a different division.
    stubIntent(intent("pi_1", "succeeded", 500,
        Map.of("user_id", USER_ID, "challenge_id", CHALLENGE)));

    assertEquals(402, controller.handle(record("pi_1", entry())).getStatusCode().value());
    verifyNothingRecorded();
  }

  @Test
  void anEntryClaimingSomebodyElsesEmailIsRefused() {
    Map<String, Object> entry = entry();
    entry.put("creator_email", "bob@example.com");

    ResponseEntity<?> response = controller.handle(record("pi_1", entry));

    assertEquals(403, response.getStatusCode().value());
    // Refused outright rather than silently corrected: a mismatch means the
    // client is confused about who is signed in.
    verify(stripe, never()).getPaymentIntent(any());
  }

  @Test
  void theKidsFreezeIsCheckedBeforeThePaymentIsBurned() {
    // The ordering that matters most here. Burning first would take the fee
    // from a parent whose child's entry is then refused.
    when(consents.anyExists()).thenReturn(false);
    stubIntent(intent("pi_1", "succeeded", 2500,
        Map.of("user_id", USER_ID, "challenge_id", CHALLENGE)));

    Map<String, Object> entry = entry();
    entry.put("division_id", "children");

    ResponseEntity<?> response = controller.handle(record("pi_1", entry));

    assertEquals(403, response.getStatusCode().value());
    verify(stripe, never()).markMetadata(any(), any(), any());
    verifyNothingRecorded();
  }

  @Test
  void aFailedBurnMeansNoEntryIsRecorded() {
    // A payment that could not be marked as spent must not produce an entry,
    // or it could be spent again. Losing the entry is recoverable; losing the
    // burn is not.
    stubIntent(intent("pi_1", "succeeded", 2500,
        Map.of("user_id", USER_ID, "challenge_id", CHALLENGE)));
    when(stripe.markMetadata(any(), any(), any()))
        .thenThrow(new StripeClient.StripeException("network", 502));

    ResponseEntity<?> response = controller.handle(record("pi_1", entry()));

    assertEquals(502, response.getStatusCode().value());
    verifyNothingRecorded();
  }

  @Test
  void aGoodPaymentBurnsThenRecordsInThatOrder() {
    stubIntent(intent("pi_1", "succeeded", 2500,
        Map.of("user_id", USER_ID, "challenge_id", CHALLENGE)));

    ResponseEntity<?> response = controller.handle(record("pi_1", entry()));

    assertEquals(200, response.getStatusCode().value());
    var order = org.mockito.Mockito.inOrder(stripe, upstream);
    order.verify(stripe).markMetadata("pi_1", "entry_recorded", "1");
    order.verify(upstream).post(eq("submit_entry"), any());
  }

  @Test
  void theRecordedEntrantIsAlwaysTheSignedInAccount() {
    stubIntent(intent("pi_1", "succeeded", 2500,
        Map.of("user_id", USER_ID, "challenge_id", CHALLENGE)));

    // No creator_email supplied at all — it must be filled from the session,
    // never left blank.
    controller.handle(record("pi_1", entry()));

    ArgumentCaptor<Map<String, Object>> sent = captor();
    verify(upstream).post(eq("submit_entry"), sent.capture());
    @SuppressWarnings("unchecked")
    Map<String, Object> entry = (Map<String, Object>) sent.getValue().get("entry");
    assertEquals(EMAIL, entry.get("creator_email"));
  }

  @Test
  void anIncompleteEntryIsRefusedBeforeStripeIsCalled() {
    Map<String, Object> entry = entry();
    entry.remove("work_url");

    ResponseEntity<?> response = controller.handle(record("pi_1", entry));

    assertEquals(400, response.getStatusCode().value());
    verify(stripe, never()).getPaymentIntent(any());
  }

  @Test
  void withoutStripeKeysEveryActionRefusesClearly() {
    when(stripe.isConfigured()).thenReturn(false);

    ResponseEntity<?> response = controller.handle(Map.of(
        "action", "create_intent", "challenge_id", CHALLENGE));

    assertEquals(500, response.getStatusCode().value());
    assertTrue(String.valueOf(((Map<?, ?>) response.getBody()).get("error"))
        .contains("Stripe keys not configured"));
  }

  // ------------------------------------------------------------ fixtures

  private void stubIntent(JsonNode intent) {
    when(stripe.getPaymentIntent(anyString())).thenReturn(intent);
    when(stripe.markMetadata(any(), any(), any())).thenReturn(intent);
  }

  private void verifyNothingRecorded() {
    verify(upstream, never()).post(eq("submit_entry"), any());
  }

  private static Map<String, Object> record(String paymentIntentId, Map<String, Object> entry) {
    Map<String, Object> request = new LinkedHashMap<>();
    request.put("action", "record_entry_payment");
    request.put("payment_intent_id", paymentIntentId);
    request.put("entry", entry);
    return request;
  }

  private static Map<String, Object> entry() {
    Map<String, Object> entry = new LinkedHashMap<>();
    entry.put("challenge_id", CHALLENGE);
    entry.put("title", "My song");
    entry.put("work_url", "https://example.com/song");
    return entry;
  }

  private JsonNode intent(String id, String status, long amount, Map<String, String> metadata) {
    var node = mapper.createObjectNode();
    node.put("id", id);
    node.put("status", status);
    node.put("amount", amount);
    node.put("amount_received", amount);
    node.put("client_secret", id + "_secret");
    var meta = mapper.createObjectNode();
    metadata.forEach(meta::put);
    node.set("metadata", meta);
    return node;
  }

  @SuppressWarnings("unchecked")
  private static ArgumentCaptor<Map<String, Object>> captor() {
    return ArgumentCaptor.forClass((Class<Map<String, Object>>) (Class<?>) Map.class);
  }
}
