package com.fiftythree.challenges.host;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Component;

/**
 * What a host application costs, and where it routes for review. A port of
 * {@code base44/shared/hostPricing.ts}.
 *
 * <p>All amounts are integer cents. The prices live here rather than in the
 * database because they are the same for everyone and a host must not be able
 * to influence them: {@link #price} reads only the package key and the add-on
 * keys, and anything it does not recognise is dropped rather than charged.
 */
@Component
public class HostPricing {

  /** A priced line: what it is called and what it costs, in cents. */
  private record Fee(long amount, String label) {}

  private static final Map<String, Fee> PACKAGES = Map.of(
      "self_service", new Fee(0, "Self-service package"),
      "supported", new Fee(14900, "Supported package deposit"),
      "fully_managed", new Fee(29900, "Fully managed package deposit"));

  private static final Map<String, Fee> ADDONS = Map.of(
      "legal_review", new Fee(9900, "Legal review"),
      "social_campaign", new Fee(14900, "Social campaign setup"),
      "entry_moderation", new Fee(9900, "Entry moderation"),
      "judging_panel", new Fee(19900, "Judging panel"),
      "prize_handling", new Fee(7900, "Prize handling"),
      "winner_showcase", new Fee(5900, "Winner showcase"));

  /** Divisions that send an application to compliance whatever else it says. */
  private static final List<String> CHILD_DIVISIONS = List.of("children", "teens");

  /** The quote for one set of answers. */
  public record Quote(long totalAmount, boolean paymentRequired, Map<String, Object> breakdown) {}

  /**
   * Prices an application.
   *
   * <p>An unrecognised package falls back to self-service — free — rather than
   * to a paid tier, so a typo or an older client cannot bill somebody for
   * something they did not choose.
   */
  public Quote price(Map<String, Object> answers) {
    String requested = str(answers.get("delivery_level"));
    String packageKey = PACKAGES.containsKey(requested) ? requested : "self_service";
    Fee selected = PACKAGES.get(packageKey);

    List<Map<String, Object>> addons = new ArrayList<>();
    long addonsTotal = 0;
    for (String key : stringList(answers.get("addons"))) {
      Fee addon = ADDONS.get(key);
      if (addon == null) {
        continue;
      }
      Map<String, Object> line = new LinkedHashMap<>();
      line.put("key", key);
      line.put("name", addon.label());
      line.put("amount", addon.amount());
      addons.add(line);
      addonsTotal += addon.amount();
    }

    long total = selected.amount() + addonsTotal;

    Map<String, Object> breakdown = new LinkedHashMap<>();
    breakdown.put("currency", "aud");
    breakdown.put("package", Map.of(
        "key", packageKey, "label", selected.label(), "amount", selected.amount()));
    breakdown.put("addons", addons);
    breakdown.put("addons_total", addonsTotal);
    breakdown.put("total_amount", total);
    breakdown.put("payment_required", total > 0);

    return new Quote(total, total > 0, breakdown);
  }

  /**
   * Where an application goes for review, and how carefully.
   *
   * <p>Children or teens means compliance, always — ahead of size and ahead of
   * how much was paid. A large or fully-managed programme is a bigger
   * commercial risk; a programme involving minors is a different kind of risk
   * and gets the queue that is equipped for it.
   */
  public Map<String, String> score(Map<String, Object> answers) {
    List<String> divisions = stringList(answers.get("divisions"));
    boolean minors = divisions.stream().anyMatch(CHILD_DIVISIONS::contains);

    if (minors) {
      return Map.of("risk_level", "high", "route_queue", "compliance");
    }
    if ("1000_plus".equals(str(answers.get("participant_range")))) {
      return Map.of("risk_level", "medium", "route_queue", "senior");
    }
    if ("fully_managed".equals(str(answers.get("delivery_level")))) {
      return Map.of("risk_level", "medium", "route_queue", "coordinator");
    }
    return Map.of("risk_level", "low", "route_queue", "standard");
  }

  /** The add-on catalogue, for a client that wants to show the options. */
  public Map<String, Object> addonCatalogue() {
    Map<String, Object> out = new LinkedHashMap<>();
    ADDONS.forEach((key, fee) -> out.put(key,
        Map.of("amount", fee.amount(), "name", fee.label())));
    return out;
  }

  private static List<String> stringList(Object value) {
    if (!(value instanceof List<?> list)) {
      return List.of();
    }
    return list.stream().map(String::valueOf).toList();
  }

  private static String str(Object value) {
    return value == null ? "" : String.valueOf(value).trim();
  }
}
