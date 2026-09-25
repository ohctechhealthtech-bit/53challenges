package com.fiftythree.challenges.pricing;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fiftythree.challenges.entity.CampaignScaleBandRepository;
import com.fiftythree.challenges.entity.CategoryRepository;
import com.fiftythree.challenges.entity.DeliverableRepository;
import com.fiftythree.challenges.entity.RateCardEntity;
import com.fiftythree.challenges.entity.SavedQuoteEntity;
import com.fiftythree.challenges.entity.ServiceTierRepository;
import com.fiftythree.challenges.security.CallerResolver;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/**
 * The Java replacement for {@code pricingCalculator}: the rate card and the
 * quotes built from it.
 *
 * <p>A saved quote stores the rate card <em>version</em> it was priced against,
 * and editing a rate card creates a new version rather than changing the old
 * one. Together those mean a quote given to a host can always be explained
 * later, even after prices change — which is the difference between a quote and
 * a guess.
 */
@RestController
public class PricingCalculatorController {

  private static final Logger log = LoggerFactory.getLogger(PricingCalculatorController.class);

  private static final double DEFAULT_GST_PCT = 10;

  private final RateCardQueryRepository rateCards;
  private final SavedQuoteQueryRepository quotes;
  private final ServiceTierRepository tiers;
  private final CampaignScaleBandRepository bands;
  private final DeliverableRepository deliverables;
  private final CategoryRepository categories;
  private final CallerResolver caller;
  private final ObjectMapper mapper;

  public PricingCalculatorController(
      RateCardQueryRepository rateCards,
      SavedQuoteQueryRepository quotes,
      ServiceTierRepository tiers,
      CampaignScaleBandRepository bands,
      DeliverableRepository deliverables,
      CategoryRepository categories,
      CallerResolver caller,
      ObjectMapper mapper) {
    this.rateCards = rateCards;
    this.quotes = quotes;
    this.tiers = tiers;
    this.bands = bands;
    this.deliverables = deliverables;
    this.categories = categories;
    this.caller = caller;
    this.mapper = mapper;
  }

  @PostMapping("/api/apps/{appId}/functions/pricingCalculator")
  public ResponseEntity<?> handle(@RequestBody(required = false) Map<String, Object> body) {
    Map<String, Object> request = body == null ? Map.of() : body;
    String sessionToken = str(request.get("session_token"));
    String email = caller.email(sessionToken);
    if (email == null) {
      return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
    }
    boolean isAdmin = caller.isAdmin(sessionToken);
    String action = str(request.get("action"));

    try {
      return switch (action) {
        case "get_active_rate_card" -> activeRateCard();
        case "save_quote" -> saveQuote(request, email);
        case "get_saved_quote" -> getQuote(request);
        case "link_quote_to_intake" -> linkToIntake(request);
        case "get_quote_for_intake" -> quoteForIntake(request);
        case "list_rate_cards" -> isAdmin
            ? ResponseEntity.ok(Map.of("rate_cards", rateCards.findAllNewestVersionFirst()))
            : adminOnly();
        case "save_rate_card" -> isAdmin ? saveRateCard(request) : adminOnly();
        default -> ResponseEntity.badRequest().body(Map.of("error", "Unknown action"));
      };
    } catch (Exception e) {
      log.error("pricingCalculator action '{}' failed", action, e);
      return ResponseEntity.status(500).body(Map.of("error", e.getMessage()));
    }
  }

  private static ResponseEntity<?> adminOnly() {
    return ResponseEntity.status(403).body(Map.of("error", "Admin only"));
  }

  private ResponseEntity<?> activeRateCard() {
    Map<String, Object> out = new LinkedHashMap<>();
    out.put("rate_card", rateCards.findActive().stream().findFirst().orElse(null));
    out.put("service_tiers", tiers.findAll());
    out.put("scale_bands", bands.findAll());
    out.put("deliverables", deliverables.findAll());
    out.put("categories", categories.findAll());
    return ResponseEntity.ok(out);
  }

  private ResponseEntity<?> saveQuote(Map<String, Object> request, String email) {
    String rateCardId = str(request.get("rate_card_id"));
    if (rateCardId.isEmpty()) {
      return ResponseEntity.badRequest().body(Map.of("error", "rate_card_id required"));
    }
    RateCardEntity card = rateCards.findById(rateCardId).orElse(null);

    Instant now = Instant.now();
    SavedQuoteEntity q = new SavedQuoteEntity();
    q.setId(newId());
    q.setRateCardId(rateCardId);
    // The version is stored on the quote, so the prices behind it can be
    // reconstructed even after the card is superseded.
    q.setRateCardVersion(card == null || card.getVersion() == null ? 1 : card.getVersion());
    q.setConfiguration(writeJson(request.get("configuration"), "{}"));
    q.setComputedLines(writeJson(request.get("computed_lines"), "[]"));
    q.setSubtotal(toDouble(request.get("subtotal")));
    q.setGst(toDouble(request.get("gst")));
    q.setTotal(toDouble(request.get("total")));
    q.setIsEnterprise(truthy(request.get("is_enterprise")));
    q.setCreatedFor(firstNonBlank(str(request.get("created_for")), email));
    q.setIntakeResponseId("");
    q.setCreatedDate(now);
    q.setUpdatedDate(now);
    q.setIsSample(false);
    return ResponseEntity.ok(Map.of("saved_quote", quotes.save(q)));
  }

  private ResponseEntity<?> getQuote(Map<String, Object> request) {
    String id = str(request.get("saved_quote_id"));
    if (id.isEmpty()) {
      return ResponseEntity.badRequest().body(Map.of("error", "saved_quote_id required"));
    }
    SavedQuoteEntity q = quotes.findById(id).orElse(null);
    if (q == null) {
      return ResponseEntity.status(404).body(Map.of("error", "Saved quote not found"));
    }
    Map<String, Object> out = new LinkedHashMap<>();
    out.put("saved_quote", q);
    // The card is returned alongside so the caller sees the prices this quote
    // was actually built from.
    out.put("rate_card", rateCards.findById(nz(q.getRateCardId())).orElse(null));
    return ResponseEntity.ok(out);
  }

  private ResponseEntity<?> linkToIntake(Map<String, Object> request) {
    String quoteId = str(request.get("saved_quote_id"));
    String intakeId = str(request.get("intake_response_id"));
    if (quoteId.isEmpty() || intakeId.isEmpty()) {
      return ResponseEntity.badRequest()
          .body(Map.of("error", "saved_quote_id and intake_response_id required"));
    }
    SavedQuoteEntity q = quotes.findById(quoteId).orElse(null);
    if (q == null) {
      return ResponseEntity.status(404).body(Map.of("error", "Saved quote not found"));
    }
    q.setIntakeResponseId(intakeId);
    q.setUpdatedDate(Instant.now());
    quotes.save(q);
    return ResponseEntity.ok(Map.of("ok", true));
  }

  private ResponseEntity<?> quoteForIntake(Map<String, Object> request) {
    String intakeId = str(request.get("intake_response_id"));
    if (intakeId.isEmpty()) {
      return ResponseEntity.badRequest().body(Map.of("error", "intake_response_id required"));
    }
    Map<String, Object> out = new LinkedHashMap<>();
    out.put("saved_quote", quotes.findForIntake(intakeId).stream().findFirst().orElse(null));
    return ResponseEntity.ok(out);
  }

  /**
   * Saves a rate card as a NEW version and retires the previous one.
   *
   * <p>Editing in place would silently change the prices behind every quote
   * already given against that card. Versioning keeps each quote explainable,
   * and the old card is linked forward via {@code superseded_by_id} so the
   * chain can be followed.
   */
  private ResponseEntity<?> saveRateCard(Map<String, Object> request) {
    List<RateCardEntity> active = rateCards.findActive();
    RateCardEntity current = active.stream().findFirst().orElse(null);
    Instant now = Instant.now();

    for (RateCardEntity old : active) {
      old.setIsActive(false);
      old.setUpdatedDate(now);
    }
    rateCards.saveAll(active);

    RateCardEntity created = new RateCardEntity();
    created.setId(newId());
    created.setVersion((current == null || current.getVersion() == null ? 0 : current.getVersion()) + 1);
    created.setIsActive(true);
    created.setSupersededById("");
    created.setChangeNote(str(request.get("change_note")));
    // Anything not supplied is carried forward from the current card, so a
    // partial edit does not blank out the rest of the pricing.
    created.setTierBaseFees(inherit(request, "tier_base_fees", current == null ? null : current.getTierBaseFees()));
    created.setParticipantsIncluded(inherit(request, "participants_included", current == null ? null : current.getParticipantsIncluded()));
    created.setPerExtra100(inherit(request, "per_extra_100", current == null ? null : current.getPerExtra100()));
    created.setWeeksIncluded(inherit(request, "weeks_included", current == null ? null : current.getWeeksIncluded()));
    created.setPerExtraWeek(inherit(request, "per_extra_week", current == null ? null : current.getPerExtraWeek()));
    created.setJudgingFees(inherit(request, "judging_fees", current == null ? null : current.getJudgingFees()));
    created.setAddonFees(inherit(request, "addon_fees", current == null ? null : current.getAddonFees()));
    created.setProgramDiscounts(inherit(request, "program_discounts", current == null ? null : current.getProgramDiscounts()));
    created.setPermitAssistanceFee(inheritNumber(request, "permit_assistance_fee",
        current == null ? null : current.getPermitAssistanceFee(), 0));
    created.setPrizeAdminPct(inheritNumber(request, "prize_admin_pct",
        current == null ? null : current.getPrizeAdminPct(), 0));
    created.setGstPct(inheritNumber(request, "gst_pct",
        current == null ? null : current.getGstPct(), DEFAULT_GST_PCT));
    created.setCreatedDate(now);
    created.setUpdatedDate(now);
    created.setIsSample(false);
    rateCards.save(created);

    if (current != null) {
      current.setSupersededById(created.getId());
      rateCards.save(current);
    }

    return ResponseEntity.ok(Map.of("rate_card", created));
  }

  /** The supplied value, or the current card's, or an empty object. */
  private String inherit(Map<String, Object> request, String field, String currentValue) {
    if (request.containsKey(field) && request.get(field) != null) {
      return writeJson(request.get(field), "{}");
    }
    return currentValue == null || currentValue.isBlank() ? "{}" : currentValue;
  }

  private static double inheritNumber(
      Map<String, Object> request, String field, Double currentValue, double fallback) {
    if (request.containsKey(field) && request.get(field) != null) {
      return toDouble(request.get(field));
    }
    return currentValue == null ? fallback : currentValue;
  }

  private String writeJson(Object value, String fallback) {
    if (value == null) {
      return fallback;
    }
    try {
      return mapper.writeValueAsString(value);
    } catch (Exception e) {
      return fallback;
    }
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
