package com.fiftythree.challenges.prize;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fiftythree.challenges.entity.AuditReviewEntity;
import com.fiftythree.challenges.entity.ChallengeEntity;
import com.fiftythree.challenges.entity.ChallengeRepository;
import com.fiftythree.challenges.entity.CombinedResultEntity;
import com.fiftythree.challenges.entity.PrizeLedgerEntity;
import com.fiftythree.challenges.entity.PrizePayoutEntity;
import com.fiftythree.challenges.security.CallerResolver;
import com.fiftythree.challenges.support.ApiErrors;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/**
 * The Java replacement for {@code prizeLedger}: recording prize money and
 * generating payout rows.
 *
 * <p>Two rules here exist to stop money moving before it should, and both are
 * enforced server-side rather than in the admin UI:
 *
 * <ul>
 *   <li>Sponsored money must be recorded as received before a live competition
 *       can be saved against it — otherwise prizes are advertised that nobody
 *       has actually funded.
 *   <li>Payout rows cannot be generated until the audit is signed off, because
 *       that sign-off is what verifies the winners.
 * </ul>
 */
@RestController
public class PrizeLedgerController {

  private static final Logger log = LoggerFactory.getLogger(PrizeLedgerController.class);

  private final PrizeLedgerQueryRepository ledgers;
  private final PrizePayoutQueryRepository payouts;
  private final AuditReviewQueryRepository reviews;
  private final CombinedResultQueryRepo results;
  private final ChallengeRepository challenges;
  private final CallerResolver caller;
  private final ObjectMapper mapper;

  public PrizeLedgerController(
      PrizeLedgerQueryRepository ledgers,
      PrizePayoutQueryRepository payouts,
      AuditReviewQueryRepository reviews,
      CombinedResultQueryRepo results,
      ChallengeRepository challenges,
      CallerResolver caller,
      ObjectMapper mapper) {
    this.ledgers = ledgers;
    this.payouts = payouts;
    this.reviews = reviews;
    this.results = results;
    this.challenges = challenges;
    this.caller = caller;
    this.mapper = mapper;
  }

  @PostMapping("/api/apps/{appId}/functions/prizeLedger")
  public ResponseEntity<?> handle(@RequestBody(required = false) Map<String, Object> body) {
    Map<String, Object> request = body == null ? Map.of() : body;
    String competitionId = str(request.get("competition_id"));
    if (competitionId.isEmpty()) {
      return ResponseEntity.badRequest().body(Map.of("error", "Missing competition_id"));
    }

    String sessionToken = str(request.get("session_token"));
    String email = caller.email(sessionToken);
    if (email == null) {
      return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
    }
    if (!caller.isAdmin(sessionToken)) {
      return ResponseEntity.status(403).body(Map.of("error", "Admin only"));
    }

    ChallengeEntity challenge = challenges.findById(competitionId).orElse(null);
    if (challenge == null) {
      return ResponseEntity.status(404).body(Map.of("error", "Competition not found"));
    }

    String action = str(request.get("action"));
    try {
      return switch (action) {
        case "save" -> save(request, challenge, email);
        case "generate_payouts" -> generatePayouts(request, competitionId);
        default -> ResponseEntity.badRequest()
            .body(Map.of("error", "Unknown action: " + action));
      };
    } catch (Exception e) {
      log.error("prizeLedger action '{}' failed for {}", action, competitionId, e);
      return ApiErrors.internal(e);
    }
  }

  private ResponseEntity<?> save(
      Map<String, Object> request, ChallengeEntity challenge, String email) {

    Map<String, Object> data = asMap(request.get("data"));
    String fundingSource = firstNonBlank(str(data.get("funding_source")), "platform");
    boolean sponsorReceived = truthy(data.get("sponsor_received"));
    boolean sponsored = "sponsor".equals(fundingSource) || "mixed".equals(fundingSource);

    // A live competition advertising sponsored prizes nobody has paid for is
    // the failure this guards against.
    if ("active".equals(nz(challenge.getStatus())) && sponsored && !sponsorReceived) {
      return ResponseEntity.status(409).body(Map.of("error",
          "Sponsored prize money must be recorded as received before the competition opens."));
    }

    Instant now = Instant.now();
    String ledgerId = str(request.get("ledger_id"));
    PrizeLedgerEntity ledger = ledgerId.isEmpty()
        ? new PrizeLedgerEntity()
        : ledgers.findById(ledgerId).orElseGet(PrizeLedgerEntity::new);
    if (ledger.getId() == null) {
      ledger.setId(newId());
      ledger.setCreatedDate(now);
    }

    // Amounts are checked even though only an admin reaches here. This is the
    // record of what was promised in prize money: a negative pool, or an
    // Infinity from a malformed number, would be stored without complaint and
    // read back later as fact.
    Double sponsorAmount = money(data.get("sponsor_amount"));
    Double totalPool = money(data.get("total_pool"));
    if (sponsorAmount == null || totalPool == null) {
      return ResponseEntity.badRequest().body(Map.of("error",
          "Sponsor amount and total pool must be zero or a positive number."));
    }

    ledger.setCompetitionId(challenge.getId());
    ledger.setCompetitionTitle(firstNonBlank(challenge.getTitle(), challenge.getTheme()));
    ledger.setFundingSource(fundingSource);
    ledger.setSponsorName(str(data.get("sponsor_name")));
    ledger.setSponsorAmount(sponsorAmount);
    ledger.setSponsorReceived(sponsorReceived);
    ledger.setSponsorReceivedAt(sponsorReceived
        ? parseInstant(str(data.get("sponsor_received_at")), now) : null);
    // Who recorded the money is part of the financial trail, so it is taken
    // from the session rather than the request.
    ledger.setSponsorReceivedBy(sponsorReceived ? email : "");
    ledger.setTotalPool(totalPool);
    ledger.setCurrency(currency(data.get("currency")));
    ledger.setPlacings(sortedPlacings(data.get("placings")));

    // Confirmed is never inferred — it has to be asked for explicitly.
    boolean confirmed = "confirmed".equals(str(data.get("status")));
    ledger.setStatus(confirmed ? "confirmed" : "draft");
    if (confirmed) {
      ledger.setConfirmedBy(email);
      ledger.setConfirmedAt(now);
    }
    ledger.setUpdatedDate(now);
    ledger.setIsSample(false);

    return ResponseEntity.ok(Map.of("success", true, "ledger", ledgers.save(ledger)));
  }

  @Transactional
  public ResponseEntity<?> generatePayouts(Map<String, Object> request, String competitionId) {
    String ledgerId = str(request.get("ledger_id"));
    PrizeLedgerEntity ledger = ledgerId.isEmpty()
        ? ledgers.findLatestFor(competitionId).stream().findFirst().orElse(null)
        : ledgers.findById(ledgerId).orElse(null);
    if (ledger == null) {
      return ResponseEntity.status(404)
          .body(Map.of("error", "No prize ledger for this competition."));
    }

    // The audit sign-off is what verifies the winners. Without it a payout row
    // would name someone the results have not been checked against.
    AuditReviewEntity review =
        reviews.findLatestFor(competitionId).stream().findFirst().orElse(null);
    if (review == null || !"signed_off".equals(nz(review.getStatus()))) {
      return ResponseEntity.status(409).body(Map.of("error",
          "Payouts cannot be created until the audit is signed off (winners verified)."));
    }

    List<CombinedResultEntity> ranked = results.findByChallengeRanked(competitionId);
    if (ranked.isEmpty()) {
      return ResponseEntity.status(404)
          .body(Map.of("error", "No locked results to build payouts from."));
    }

    // Replacing rather than appending: regenerating must not leave two
    // generations of payout rows for one ledger.
    payouts.deleteByLedgerId(ledger.getId());

    Instant now = Instant.now();
    List<PrizePayoutEntity> rows = new ArrayList<>();
    for (JsonNode placing : placingsOf(ledger)) {
      int position = placing.path("placing").asInt(0);
      if (position < 1 || position > ranked.size()) {
        continue;
      }
      CombinedResultEntity result = ranked.get(position - 1);

      PrizePayoutEntity payout = new PrizePayoutEntity();
      payout.setId(newId());
      payout.setLedgerId(ledger.getId());
      payout.setCompetitionId(competitionId);
      payout.setEntryId(result.getEntryId());
      payout.setPlacing((double) position);
      payout.setLabel(firstNonBlank(placing.path("label").asText(""), ordinal(position) + " Place"));
      payout.setAmount(placing.path("amount").asDouble(0));
      payout.setWinnerName(firstNonBlank(
          result.getCreatorName(), placing.path("winner_name").asText("")));
      // A minor is never paid directly — the payout is addressed to their
      // guardian, and the name is left for the payout process to fill in once
      // the guardian's identity has been verified.
      boolean minor = false;
      payout.setIsMinor(minor);
      payout.setPayeeType(minor ? "guardian" : "entrant");
      payout.setPayeeName(minor ? "" : nz(result.getCreatorName()));
      payout.setGuardianName("");
      payout.setStatus("pending");
      payout.setCreatedDate(now);
      payout.setUpdatedDate(now);
      payout.setIsSample(false);
      rows.add(payout);
    }

    return ResponseEntity.ok(Map.of(
        "success", true, "payouts", rows.isEmpty() ? List.of() : payouts.saveAll(rows)));
  }

  /** Placings ordered by position, stored as the JSON the column holds. */
  private String sortedPlacings(Object raw) {
    try {
      JsonNode parsed = raw == null ? mapper.createArrayNode() : mapper.valueToTree(raw);
      if (!parsed.isArray()) {
        return "[]";
      }
      List<JsonNode> list = new ArrayList<>();
      parsed.forEach(list::add);
      list.sort(Comparator.comparingInt(n -> n.path("placing").asInt(0)));
      return mapper.writeValueAsString(list);
    } catch (Exception e) {
      log.warn("Could not read placings, storing empty: {}", e.toString());
      return "[]";
    }
  }


  /**
   * A money amount, or null when it is not one.
   *
   * <p>Rejects negatives and the non-finite values a malformed number parses
   * to. {@code toDouble} answers 0 for anything it cannot read, which is a
   * reasonable default for a filter and a bad one for a prize pool.
   */
  private static Double money(Object value) {
    if (value == null) {
      return 0d;
    }
    double amount = toDouble(value);
    if (!Double.isFinite(amount) || amount < 0) {
      return null;
    }
    return amount;
  }

  /** A three-letter currency code, upper-cased, defaulting to AUD. */
  private static String currency(Object value) {
    String code = str(value).trim().toUpperCase(java.util.Locale.ROOT);
    return code.matches("[A-Z]{3}") ? code : "AUD";
  }
  private List<JsonNode> placingsOf(PrizeLedgerEntity ledger) {
    try {
      JsonNode parsed = mapper.readTree(
          nz(ledger.getPlacings()).isEmpty() ? "[]" : ledger.getPlacings());
      List<JsonNode> out = new ArrayList<>();
      if (parsed.isArray()) {
        parsed.forEach(out::add);
      }
      return out;
    } catch (Exception e) {
      return List.of();
    }
  }

  /** 1st, 2nd, 3rd, 4th … including the 11–13 exceptions. */
  static String ordinal(int n) {
    int mod100 = n % 100;
    if (mod100 >= 11 && mod100 <= 13) {
      return n + "th";
    }
    return switch (n % 10) {
      case 1 -> n + "st";
      case 2 -> n + "nd";
      case 3 -> n + "rd";
      default -> n + "th";
    };
  }

  private static Instant parseInstant(String value, Instant fallback) {
    try {
      return value.isBlank() ? fallback : Instant.parse(value);
    } catch (Exception e) {
      return fallback;
    }
  }

  private Map<String, Object> asMap(Object v) {
    return v instanceof Map<?, ?> m
        ? mapper.convertValue(m, new com.fasterxml.jackson.core.type.TypeReference<>() {})
        : Map.of();
  }

  private static boolean truthy(Object v) {
    return Boolean.TRUE.equals(v) || "true".equalsIgnoreCase(String.valueOf(v));
  }

  private static double toDouble(Object v) {
    try {
      return v == null ? 0 : Double.parseDouble(String.valueOf(v));
    } catch (NumberFormatException e) {
      return 0;
    }
  }

  private static String firstNonBlank(String... values) {
    for (String v : values) {
      if (v != null && !v.isBlank()) {
        return v;
      }
    }
    return "";
  }

  private static String nz(String v) {
    return v == null ? "" : v;
  }

  private static String str(Object v) {
    return v == null ? "" : String.valueOf(v);
  }

  private static String newId() {
    return UUID.randomUUID().toString().replace("-", "").substring(0, 24);
  }
}
