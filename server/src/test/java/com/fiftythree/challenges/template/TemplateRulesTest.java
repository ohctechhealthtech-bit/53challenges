package com.fiftythree.challenges.template;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.List;
import org.junit.jupiter.api.Test;

/**
 * The two pieces of the template library that decide something rather than
 * move data: what blocks a publish, and who is allowed to change which brand
 * field. Both were ported from JavaScript, and both fail quietly if they drift
 * — a publish that should have been refused produces a live challenge with no
 * tie-break rule, and a brand merge that trusts the wrong layer lets a host
 * rewrite the legal footer on their own competition.
 */
class TemplateRulesTest {

  private final ObjectMapper mapper = new ObjectMapper();
  private final TemplateDefaults defaults = new TemplateDefaults(mapper);
  private final TemplateValidator validator = new TemplateValidator();

  // ------------------------------------------------------------- the blank

  @Test
  void aBlankTemplateDoesNotValidate() {
    // It is a starting point, not a publishable template. If this ever came
    // back empty, 'create' followed by 'publish' would ship an empty shell.
    List<String> errors = validator.validate(
        "Untitled template", null,
        defaults.blankConceptPack(), defaults.blankRulesPack(), defaults.blankBrandPack());

    assertFalse(errors.isEmpty(), "a blank template must not be publishable");
    assertTrue(errors.contains("A primary category is required."), errors.toString());
    assertTrue(errors.contains("Brand: legal footer is required."), errors.toString());
  }

  @Test
  void theBlankBrandColoursAreValid() {
    // The defaults are the ones an admin never touches, so if they did not
    // match the hex rule every template would carry two phantom errors.
    List<String> errors = validator.validate(
        "n", "cat", filledConcept(), filledRules(), defaults.blankBrandPack());

    assertFalse(errors.contains("Brand: primary colour must be a valid hex value."), errors.toString());
    assertFalse(errors.contains("Brand: secondary colour must be a valid hex value."), errors.toString());
  }

  @Test
  void aFullyFilledTemplatePasses() {
    assertEquals(List.of(),
        validator.validate("Spring Sing", "cat_music", filledConcept(), filledRules(), filledBrand()));
  }

  // -------------------------------------------------------- judging weights

  @Test
  void judgingWeightsMustTotalExactlyOneHundred() {
    ObjectNode rules = filledRules();
    rules.set("judging_criteria", criteria(50, 30));

    List<String> errors = validator.validate("n", "c", filledConcept(), rules, filledBrand());

    // The running total is in the message because it is the only way for the
    // admin to see which criterion is wrong. Rendered as 80, not 80.0 — the
    // message goes straight onto the screen.
    assertTrue(errors.contains(
        "Rules: judging criteria weights must total exactly 100 (currently 80)."), errors.toString());
  }

  @Test
  void aJudgedTemplateWithNoCriteriaIsRejected() {
    ObjectNode rules = filledRules();
    rules.set("judging_criteria", mapper.createArrayNode());

    assertTrue(validator.validate("n", "c", filledConcept(), rules, filledBrand())
        .contains("Rules: judging-based methods need at least one judging criterion."));
  }

  @Test
  void aRandomDrawNeedsNoJudgingCriteria() {
    // random_draw is not a judging method, so the criteria rules do not apply.
    // Getting this wrong makes every raffle-style template unpublishable.
    ObjectNode rules = filledRules();
    rules.put("winner_selection_method", "random_draw");
    rules.set("judging_criteria", mapper.createArrayNode());

    assertEquals(List.of(), validator.validate("n", "c", filledConcept(), rules, filledBrand()));
  }

  // ------------------------------------------------------------ team sizes

  @Test
  void teamEntriesNeedBothTeamSizes() {
    ObjectNode concept = filledConcept();
    concept.put("entry_type", "team");
    ObjectNode rules = filledRules();
    rules.put("team_size_minimum", 2);

    assertTrue(validator.validate("n", "c", concept, rules, filledBrand())
        .contains("Rules: team entries need a minimum and maximum team size."));
  }

  // ------------------------------------------------------------ brand merge

  @Test
  void aHostMayOverrideOnlyHostEditableFields() {
    ObjectNode snapshot = defaults.blankBrandPack();
    snapshot.put("legal_footer", "Set by the platform");

    ObjectNode hostOverrides = mapper.createObjectNode();
    hostOverrides.put("campaign_message", "Sing for the school");
    // The host posts a legal footer anyway. The lock map is the only thing
    // stopping it, which is precisely what this asserts.
    hostOverrides.put("legal_footer", "No rules apply");

    ObjectNode merged = defaults.mergeApprovedBrand(
        snapshot, hostOverrides, null, defaults.defaultLockMap());

    assertEquals("Sing for the school", merged.path("campaign_message").asText());
    assertEquals("Set by the platform", merged.path("legal_footer").asText());
  }

  @Test
  void anEmptyHostOverrideDoesNotBlankTheTemplateValue() {
    ObjectNode snapshot = defaults.blankBrandPack();
    snapshot.put("campaign_message", "From the template");

    ObjectNode hostOverrides = mapper.createObjectNode();
    hostOverrides.put("campaign_message", "");

    ObjectNode merged = defaults.mergeApprovedBrand(
        snapshot, hostOverrides, null, defaults.defaultLockMap());

    assertEquals("From the template", merged.path("campaign_message").asText());
  }

  @Test
  void adminAdjustmentsOverrideEverything() {
    ObjectNode hostOverrides = mapper.createObjectNode();
    hostOverrides.put("campaign_message", "Host wording");

    ObjectNode adminAdjustments = mapper.createObjectNode();
    adminAdjustments.put("campaign_message", "Approved wording");
    adminAdjustments.put("legal_footer", "Approved footer");

    ObjectNode merged = defaults.mergeApprovedBrand(
        defaults.blankBrandPack(), hostOverrides, adminAdjustments, defaults.defaultLockMap());

    assertEquals("Approved wording", merged.path("campaign_message").asText());
    assertEquals("Approved footer", merged.path("legal_footer").asText());
  }

  @Test
  void anEmptyLockMapFallsBackToTheDefaultNotToOpenSeason() {
    // A proposal whose snapshot predates lock maps has an empty one. Treating
    // that as "no field is locked" would hand the host the legal footer.
    ObjectNode hostOverrides = mapper.createObjectNode();
    hostOverrides.put("legal_footer", "No rules apply");

    ObjectNode merged = defaults.mergeApprovedBrand(
        defaults.blankBrandPack(), hostOverrides, null, mapper.createObjectNode());

    assertEquals("", merged.path("legal_footer").asText());
  }

  @Test
  void theDefaultLockMapCoversEveryBrandField() {
    // A brand field with no entry in the lock map is a field the merge simply
    // ignores — the host silently loses the ability to set it.
    ObjectNode lockMap = defaults.defaultLockMap();
    defaults.blankBrandPack().fieldNames().forEachRemaining(field ->
        assertTrue(lockMap.has(field), "brand field '" + field + "' has no lock-map entry"));
  }

  // --------------------------------------------------------------- fixtures

  private ObjectNode filledConcept() {
    ObjectNode c = defaults.blankConceptPack();
    c.put("package_name", "Spring Sing");
    c.put("challenge_description", "A school singing competition running over four weeks.");
    c.put("expected_outcome", "One winner per age group");
    return c;
  }

  private ObjectNode filledRules() {
    ObjectNode r = defaults.blankRulesPack();
    r.put("eligibility_summary", "Open to enrolled students");
    r.set("age_groups", mapper.createArrayNode().add("under_18"));
    r.set("judging_criteria", criteria(60, 40));
    r.put("tie_breaking_method", "earliest_entry");
    return r;
  }

  private ObjectNode filledBrand() {
    ObjectNode b = defaults.blankBrandPack();
    b.put("campaign_message", "Sing out");
    b.put("call_to_action", "Enter now");
    b.put("legal_footer", "Terms apply");
    return b;
  }

  private com.fasterxml.jackson.databind.node.ArrayNode criteria(int... weights) {
    var array = mapper.createArrayNode();
    for (int weight : weights) {
      array.add(mapper.createObjectNode().put("name", "c" + weight).put("weight", weight));
    }
    return array;
  }
}
