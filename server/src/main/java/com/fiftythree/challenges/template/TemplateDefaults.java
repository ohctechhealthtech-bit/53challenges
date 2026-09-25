package com.fiftythree.challenges.template;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.security.SecureRandom;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Component;

/**
 * The template-library defaults, a port of {@code base44/shared/templateLibrary.ts}.
 *
 * <p>The shapes here are not decoration: the admin wizard reads every one of
 * these keys and renders a control for each. A pack that comes back missing a
 * key shows as an empty tab rather than an empty input, so the blank template is
 * reproduced key for key, including the keys whose value is an empty string.
 *
 * <p>{@code rankTemplates}/{@code scoreTemplate} from the original module are
 * deliberately not ported — the function imported them but never called them,
 * and {@code recommend} sorts on the master API's own {@code sort_order}.
 */
@Component
public class TemplateDefaults {

  /** Brand fields a host may override on their own proposal. */
  public static final List<String> HOST_EDITABLE_BRAND_FIELDS = List.of(
      "logo_url",
      "primary_colour_hex",
      "secondary_colour_hex",
      "hero_image_url",
      "campaign_message",
      "hashtag",
      "call_to_action");

  /** Brand fields only an admin may set — the legal and attribution ones. */
  public static final List<String> ADMIN_MANAGED_BRAND_FIELDS = List.of(
      "approved_social_templates",
      "legal_footer",
      "powered_by_attribution");

  private static final SecureRandom RANDOM = new SecureRandom();

  private final ObjectMapper mapper;

  public TemplateDefaults(ObjectMapper mapper) {
    this.mapper = mapper;
  }

  public ObjectNode object() {
    return mapper.createObjectNode();
  }

  public ArrayNode array() {
    return mapper.createArrayNode();
  }

  public JsonNode nullNode() {
    return mapper.nullNode();
  }

  /**
   * Converts a value straight off the request body into a node.
   *
   * <p>Goes through the injected mapper, never a fresh {@code new
   * ObjectMapper()}: the Spring one carries the JSR-310 module, and a bare
   * mapper throws "Java 8 date/time type not supported" the first time an
   * {@link java.time.Instant} appears in a pack.
   */
  public JsonNode toNode(Object value) {
    return value == null ? mapper.nullNode() : mapper.valueToTree(value);
  }

  /** Serialises a node for a JSON column; null and missing both store as null. */
  public String write(JsonNode node) {
    if (node == null || node.isNull() || node.isMissingNode()) {
      return null;
    }
    try {
      return mapper.writeValueAsString(node);
    } catch (Exception e) {
      throw new IllegalStateException("Could not serialise a template pack", e);
    }
  }

  /** Parses a JSON column; a null, blank or malformed value reads as an empty object. */
  public ObjectNode read(String raw) {
    if (raw == null || raw.isBlank()) {
      return mapper.createObjectNode();
    }
    try {
      JsonNode parsed = mapper.readTree(raw);
      return parsed instanceof ObjectNode node ? node : mapper.createObjectNode();
    } catch (Exception e) {
      return mapper.createObjectNode();
    }
  }

  /** Parses a JSON column that should hold an array; anything else reads as empty. */
  public ArrayNode readArray(String raw) {
    if (raw == null || raw.isBlank()) {
      return mapper.createArrayNode();
    }
    try {
      JsonNode parsed = mapper.readTree(raw);
      return parsed instanceof ArrayNode node ? node : mapper.createArrayNode();
    } catch (Exception e) {
      return mapper.createArrayNode();
    }
  }

  /**
   * Who may edit which brand field. Host-editable fields the host can change on
   * their own proposal; admin-managed ones they never get a control for.
   */
  public ObjectNode defaultLockMap() {
    ObjectNode map = mapper.createObjectNode();
    for (String f : HOST_EDITABLE_BRAND_FIELDS) {
      map.put(f, "host_editable");
    }
    for (String f : ADMIN_MANAGED_BRAND_FIELDS) {
      map.put(f, "admin_managed");
    }
    return map;
  }

  /**
   * A family id for a brand-new template. The original used
   * {@code Math.random()} plus a base36 timestamp; the shape is preserved
   * ("fam_" then 8 base36 characters then a base36 millisecond clock) because
   * it appears in the audit log and in exported spreadsheets, but the
   * randomness comes from a real CSPRNG.
   */
  public String newFamilyId() {
    StringBuilder suffix = new StringBuilder();
    while (suffix.length() < 8) {
      suffix.append(Long.toString(Math.abs(RANDOM.nextLong()), 36));
    }
    return "fam_" + suffix.substring(0, 8) + Long.toString(System.currentTimeMillis(), 36);
  }

  public ObjectNode blankConceptPack() {
    ObjectNode c = mapper.createObjectNode();
    c.put("package_name", "");
    c.put("primary_category_id", "");
    c.put("subcategory_id", "");
    c.set("corporate_objective", mapper.createArrayNode());
    c.set("target_audience", mapper.createArrayNode());
    c.put("challenge_description", "");
    c.put("expected_outcome", "");
    c.put("entry_type", "individual");
    c.put("delivery_mode", "online");
    c.put("recommended_duration_weeks", 4);
    c.put("recommended_prize_structure", "");
    return c;
  }

  public ObjectNode blankRulesPack() {
    ObjectNode r = mapper.createObjectNode();
    r.put("eligibility_summary", "");
    r.set("age_groups", mapper.createArrayNode());
    r.set("eligible_locations", mapper.createArrayNode());
    r.put("winner_selection_method", "expert_judging");
    r.set("judging_criteria", mapper.createArrayNode());
    r.put("ai_use_policy", "human_only");
    r.put("ai_disclosure_required", true);
    r.put("human_contribution_statement_required", true);
    r.set("prohibited_ai_uses", mapper.createArrayNode());
    r.set("required_declarations", mapper.createArrayNode());
    r.put("prohibited_content_summary", "");
    r.put("tie_breaking_method", "");
    r.put("entry_limit_per_participant", 1);
    r.putNull("team_size_minimum");
    r.putNull("team_size_maximum");
    return r;
  }

  public ObjectNode blankBrandPack() {
    ObjectNode b = mapper.createObjectNode();
    b.put("logo_url", "");
    b.put("primary_colour_hex", "#1677C8");
    b.put("secondary_colour_hex", "#102A43");
    b.put("hero_image_url", "");
    b.put("campaign_message", "");
    b.put("hashtag", "");
    b.put("call_to_action", "");
    b.set("approved_social_templates", mapper.createArrayNode());
    b.put("legal_footer", "");
    b.put("powered_by_attribution", true);
    return b;
  }

  public ObjectNode blankRecommendationConfig() {
    ObjectNode cfg = mapper.createObjectNode();
    for (String key : List.of(
        "target_organisation_types",
        "target_categories",
        "target_service_tiers",
        "target_audience_types",
        "recommendation_categories",
        "recommendation_formats",
        "recommendation_age_groups",
        "recommendation_settings",
        "recommendation_host_types",
        "recommendation_delivery_levels",
        "recommendation_org_kinds")) {
      cfg.set(key, mapper.createArrayNode());
    }
    cfg.putNull("min_participant_count");
    cfg.putNull("max_participant_count");
    cfg.put("recommendation_weight", 1);
    return cfg;
  }

  /**
   * The brand pack a challenge actually launches with.
   *
   * <p>Three layers, applied in this order and no other: the frozen template
   * snapshot, then the host overrides but <b>only</b> for fields the lock map
   * marks host-editable, then the admin adjustments, which override anything.
   * The lock map is what stops a host rewriting the legal footer, so a missing
   * or empty one falls back to the default rather than to "everything is
   * editable".
   */
  public ObjectNode mergeApprovedBrand(
      JsonNode snapshotBrand, JsonNode hostOverrides, JsonNode adminAdjustments, JsonNode lockMap) {

    ObjectNode map = lockMap instanceof ObjectNode m && !m.isEmpty() ? m : defaultLockMap();

    ObjectNode out = mapper.createObjectNode();
    if (snapshotBrand instanceof ObjectNode snapshot) {
      out.setAll(snapshot);
    }

    Iterator<Map.Entry<String, JsonNode>> locks = map.fields();
    while (locks.hasNext()) {
      Map.Entry<String, JsonNode> lock = locks.next();
      if (!"host_editable".equals(lock.getValue().asText())) {
        continue;
      }
      JsonNode override = hostOverrides == null ? null : hostOverrides.get(lock.getKey());
      // An absent key and an empty string both mean the host left it alone. An
      // empty string must not blank out the value the template supplied.
      if (override != null && !override.isNull() && !override.asText("").isEmpty()) {
        out.set(lock.getKey(), override);
      }
    }

    if (adminAdjustments instanceof ObjectNode adjustments) {
      Iterator<Map.Entry<String, JsonNode>> it = adjustments.fields();
      while (it.hasNext()) {
        Map.Entry<String, JsonNode> adjustment = it.next();
        out.set(adjustment.getKey(), adjustment.getValue());
      }
    }
    return out;
  }
}
