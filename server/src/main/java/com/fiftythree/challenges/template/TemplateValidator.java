package com.fiftythree.challenges.template;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.regex.Pattern;
import org.springframework.stereotype.Component;

/**
 * The publish gate for a template, ported from {@code validateTemplate} in
 * {@code base44/shared/templateLibrary.ts}.
 *
 * <p>A published template is copied verbatim onto every proposal that selects
 * it and then frozen, so a missing tie-break rule or a judging weight that does
 * not total 100 becomes a live challenge nobody can settle. That is why publish
 * refuses on any error rather than warning: the cost of fixing it afterwards is
 * a challenge already in flight.
 *
 * <p>The messages are returned to the admin wizard and shown verbatim, so they
 * are reproduced word for word — including the running total in the judging
 * weights message, which is the only way to see which criterion is wrong.
 */
@Component
public class TemplateValidator {

  /** Methods that decide a winner by scoring, and so need criteria. */
  private static final Set<String> JUDGING_METHODS =
      Set.of("expert_judging", "host_judging", "community_voting", "combined");

  private static final Pattern HEX = Pattern.compile("^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$");
  private static final Pattern HTTP = Pattern.compile("^https?://.*");
  private static final Pattern WHITESPACE = Pattern.compile("\\s");

  /** Every problem with the template, in wizard order; empty means publishable. */
  public List<String> validate(
      String templateName,
      String primaryCategoryId,
      JsonNode concept,
      JsonNode rules,
      JsonNode brand) {

    List<String> errors = new ArrayList<>();

    if (isBlank(templateName)) {
      errors.add("Template name is required.");
    }
    if (isBlank(primaryCategoryId) && isBlank(text(concept, "primary_category_id"))) {
      errors.add("A primary category is required.");
    }
    if (empty(concept, "package_name")) {
      errors.add("Concept: package name is required.");
    }
    String description = text(concept, "challenge_description");
    if (description == null || description.length() < 40) {
      errors.add("Concept: description must be at least 40 characters.");
    }
    if (empty(concept, "expected_outcome")) {
      errors.add("Concept: expected outcome is required.");
    }
    if (!positive(concept, "recommended_duration_weeks")) {
      errors.add("Concept: recommended duration must be a positive number of weeks.");
    }
    if ("team".equals(text(concept, "entry_type"))
        && (!positive(rules, "team_size_minimum") || !positive(rules, "team_size_maximum"))) {
      errors.add("Rules: team entries need a minimum and maximum team size.");
    }

    if (empty(rules, "eligibility_summary")) {
      errors.add("Rules: eligibility summary is required.");
    }
    JsonNode ageGroups = rules == null ? null : rules.get("age_groups");
    if (ageGroups == null || !ageGroups.isArray() || ageGroups.isEmpty()) {
      errors.add("Rules: select at least one age group.");
    }
    if (JUDGING_METHODS.contains(text(rules, "winner_selection_method"))) {
      JsonNode criteria = rules == null ? null : rules.get("judging_criteria");
      if (criteria == null || !criteria.isArray() || criteria.isEmpty()) {
        errors.add("Rules: judging-based methods need at least one judging criterion.");
      } else {
        // Summed the way JavaScript did, so a template that passed there still
        // passes here: weights are whatever the admin typed, and a non-numeric
        // one counts as zero rather than failing the whole check.
        double total = 0;
        for (JsonNode criterion : criteria) {
          total += criterion.path("weight").asDouble(0);
        }
        if (total != 100) {
          errors.add("Rules: judging criteria weights must total exactly 100 (currently "
              + number(total) + ").");
        }
      }
    }
    if (empty(rules, "tie_breaking_method")) {
      errors.add("Rules: a tie-breaking method is required.");
    }
    if (!positive(rules, "entry_limit_per_participant")) {
      errors.add("Rules: entry limit per participant must be at least 1.");
    }

    if (!HEX.matcher(orEmpty(text(brand, "primary_colour_hex"))).matches()) {
      errors.add("Brand: primary colour must be a valid hex value.");
    }
    if (!HEX.matcher(orEmpty(text(brand, "secondary_colour_hex"))).matches()) {
      errors.add("Brand: secondary colour must be a valid hex value.");
    }
    String hashtag = text(brand, "hashtag");
    if (!isBlank(hashtag) && WHITESPACE.matcher(hashtag).find()) {
      errors.add("Brand: hashtag cannot contain spaces.");
    }
    String logoUrl = text(brand, "logo_url");
    if (!isBlank(logoUrl) && !HTTP.matcher(logoUrl).matches()) {
      errors.add("Brand: logo URL must start with http(s)://");
    }
    String heroUrl = text(brand, "hero_image_url");
    if (!isBlank(heroUrl) && !HTTP.matcher(heroUrl).matches()) {
      errors.add("Brand: hero image URL must start with http(s)://");
    }
    if (empty(brand, "campaign_message")) {
      errors.add("Brand: campaign message is required.");
    }
    if (empty(brand, "call_to_action")) {
      errors.add("Brand: call to action is required.");
    }
    if (empty(brand, "legal_footer")) {
      errors.add("Brand: legal footer is required.");
    }

    return errors;
  }

  /**
   * Renders the weight total as JavaScript would have: 100 rather than 100.0,
   * because the number lands in a message an admin reads.
   */
  private static String number(double value) {
    return value == Math.rint(value) && !Double.isInfinite(value)
        ? String.valueOf((long) value)
        : String.valueOf(value);
  }

  /**
   * True when the field parses as a number greater than zero, matching
   * {@code Number(x) > 0}: null, "", absent and non-numeric all fail.
   */
  private static boolean positive(JsonNode node, String field) {
    JsonNode value = node == null ? null : node.get(field);
    if (value == null || value.isNull()) {
      return false;
    }
    if (value.isNumber()) {
      return value.asDouble() > 0;
    }
    try {
      return Double.parseDouble(value.asText("")) > 0;
    } catch (NumberFormatException e) {
      return false;
    }
  }

  /** Matches a JavaScript falsy check on a string field: absent, null or "". */
  private static boolean empty(JsonNode node, String field) {
    String value = text(node, field);
    return value == null || value.isEmpty();
  }

  private static String text(JsonNode node, String field) {
    JsonNode value = node == null ? null : node.get(field);
    return value == null || value.isNull() ? null : value.asText("");
  }

  private static String orEmpty(String value) {
    return value == null ? "" : value;
  }

  private static boolean isBlank(String value) {
    return value == null || value.trim().isEmpty();
  }
}
