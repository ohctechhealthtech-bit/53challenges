package com.fiftythree.challenges.compliance;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/**
 * Compliance staff write these conditions as data, and three separate systems
 * read them: what triggers fire, which regulatory rules attach, and which terms
 * clauses go into the document people accept. An operator that behaves
 * differently here than it did in JavaScript silently changes which
 * competitions are treated as games of chance.
 */
class ConditionEvaluatorTest {

  private final ObjectMapper mapper = new ObjectMapper();
  private final ConditionEvaluator evaluator = new ConditionEvaluator();

  private final Map<String, Object> facts = facts();

  private static Map<String, Object> facts() {
    Map<String, Object> facts = new HashMap<>();
    facts.put("weight", 60);
    facts.put("purpose", "determines_winner");
    facts.put("tags", List.of("music", "live"));
    facts.put("paid", true);
    facts.put("blank", "");
    facts.put("nothing", null);
    return facts;
  }

  @Test
  void comparisonOperatorsWork() {
    assertTrue(matches("[{\"field\":\"weight\",\"operator\":\"gt\",\"value\":50}]"));
    assertFalse(matches("[{\"field\":\"weight\",\"operator\":\"gt\",\"value\":60}]"));
    assertTrue(matches("[{\"field\":\"weight\",\"operator\":\"gte\",\"value\":60}]"));
    assertTrue(matches("[{\"field\":\"weight\",\"operator\":\"lt\",\"value\":61}]"));
    assertTrue(matches("[{\"field\":\"weight\",\"operator\":\"lte\",\"value\":60}]"));
  }

  @Test
  void aComparisonAgainstAMissingFactIsFalse() {
    // NaN, as JavaScript's Number(undefined) gives. Every comparison against
    // it is false — including 'lt', which is the one that would otherwise
    // fire a rule on a fact that was never recorded.
    assertFalse(matches("[{\"field\":\"absent\",\"operator\":\"gt\",\"value\":0}]"));
    assertFalse(matches("[{\"field\":\"absent\",\"operator\":\"lt\",\"value\":100}]"));
    assertFalse(matches("[{\"field\":\"absent\",\"operator\":\"gte\",\"value\":0}]"));
  }

  @Test
  void equalityIsStrictAboutType() {
    assertTrue(matches("[{\"field\":\"purpose\",\"operator\":\"eq\","
        + "\"value\":\"determines_winner\"}]"));
    assertTrue(matches("[{\"field\":\"paid\",\"operator\":\"eq\",\"value\":true}]"));
    // A number 60 is not the string "60", matching ===.
    assertFalse(matches("[{\"field\":\"weight\",\"operator\":\"eq\",\"value\":\"60\"}]"));
    assertTrue(matches("[{\"field\":\"weight\",\"operator\":\"ne\",\"value\":\"60\"}]"));
  }

  @Test
  void containsHandlesListsAndStrings() {
    assertTrue(matches("[{\"field\":\"tags\",\"operator\":\"contains\",\"value\":\"live\"}]"));
    assertFalse(matches("[{\"field\":\"tags\",\"operator\":\"contains\",\"value\":\"dance\"}]"));
    assertTrue(matches("[{\"field\":\"purpose\",\"operator\":\"contains\","
        + "\"value\":\"determines\"}]"));
  }

  @Test
  void notContainsIsTrueForAValueThatIsNeitherListNorString() {
    // Asymmetric, and deliberately preserved: 'contains' on a number is false,
    // so 'not_contains' on the same number is true. Rules were written against
    // that behaviour.
    assertFalse(matches("[{\"field\":\"weight\",\"operator\":\"contains\",\"value\":\"6\"}]"));
    assertTrue(matches("[{\"field\":\"weight\",\"operator\":\"not_contains\",\"value\":\"6\"}]"));
    assertTrue(matches("[{\"field\":\"absent\",\"operator\":\"not_contains\",\"value\":\"x\"}]"));
  }

  @Test
  void existsRejectsNullAndEmptyString() {
    assertTrue(matches("[{\"field\":\"purpose\",\"operator\":\"exists\"}]"));
    assertFalse(matches("[{\"field\":\"blank\",\"operator\":\"exists\"}]"));
    assertFalse(matches("[{\"field\":\"nothing\",\"operator\":\"exists\"}]"));
    assertFalse(matches("[{\"field\":\"absent\",\"operator\":\"exists\"}]"));
  }

  @Test
  void conditionsAreAnded() {
    assertTrue(matches("[{\"field\":\"weight\",\"operator\":\"gt\",\"value\":50},"
        + "{\"field\":\"paid\",\"operator\":\"eq\",\"value\":true}]"));
    assertFalse(matches("[{\"field\":\"weight\",\"operator\":\"gt\",\"value\":50},"
        + "{\"field\":\"paid\",\"operator\":\"eq\",\"value\":false}]"));
  }

  @Test
  void anEmptyOrAbsentConditionListAlwaysMatches() {
    // A rule with no conditions applies unconditionally. Getting this backwards
    // would make every unconditional obligation disappear.
    assertTrue(matches("[]"));
    assertTrue(evaluator.matches(null, facts));
    assertTrue(evaluator.matches(mapper.createObjectNode(), facts));
  }

  @Test
  void anUnknownOperatorNeverMatches() {
    // Fail closed: a typo makes the rule inert rather than universal.
    assertFalse(matches("[{\"field\":\"weight\",\"operator\":\"approximately\",\"value\":60}]"));
    assertFalse(matches("[{\"field\":\"weight\",\"value\":60}]"));
  }

  private boolean matches(String conditions) {
    return evaluator.matches(parse(conditions), facts);
  }

  private JsonNode parse(String raw) {
    try {
      return mapper.readTree(raw);
    } catch (Exception e) {
      throw new IllegalStateException(e);
    }
  }
}
