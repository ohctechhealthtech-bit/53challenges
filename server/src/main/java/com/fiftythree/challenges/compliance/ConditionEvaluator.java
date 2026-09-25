package com.fiftythree.challenges.compliance;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Component;

/**
 * Evaluates the stored {@code {field, operator, value}} conditions that decide
 * whether a compliance trigger fires, a regulatory rule applies, or a terms
 * clause is included.
 *
 * <p>These conditions are <b>data</b>, written by compliance staff rather than
 * programmers and stored as JSON on the records they belong to. All three
 * systems share this one evaluator because they share the format — and because
 * a trigger and a clause that read the same condition differently would produce
 * a document that contradicts the assessment behind it.
 *
 * <p>Ported from the {@code evalCondition} duplicated in
 * {@code complianceAssessmentEngine.ts} and {@code termsAssembler.ts},
 * including its quirks: conditions are ANDed, an empty list always matches, an
 * unrecognised operator never matches, and {@code not_contains} is true for a
 * value that is neither a list nor a string while {@code contains} is false for
 * the same value.
 */
@Component
public class ConditionEvaluator {

  /** True when every condition holds. An empty or absent list always matches. */
  public boolean matches(JsonNode conditions, Map<String, Object> facts) {
    if (conditions == null || !conditions.isArray() || conditions.isEmpty()) {
      return true;
    }
    for (JsonNode condition : conditions) {
      if (!matchesOne(condition, facts)) {
        return false;
      }
    }
    return true;
  }

  private boolean matchesOne(JsonNode condition, Map<String, Object> facts) {
    Object value = facts.get(condition.path("field").asText(""));
    JsonNode target = condition.path("value");

    return switch (condition.path("operator").asText("")) {
      case "eq" -> sameValue(value, target);
      case "ne" -> !sameValue(value, target);
      case "gt" -> number(value) > target.asDouble(Double.NaN);
      case "gte" -> number(value) >= target.asDouble(Double.NaN);
      case "lt" -> number(value) < target.asDouble(Double.NaN);
      case "lte" -> number(value) <= target.asDouble(Double.NaN);
      case "contains" -> contains(value, target);
      case "not_contains" -> !contains(value, target);
      case "exists" -> value != null && !"".equals(value);
      // Fail closed. A condition nobody can evaluate must not include a clause
      // or fire a rule — a typo in an operator should make a rule inert, not
      // make it apply universally.
      default -> false;
    };
  }

  /**
   * Membership for a list, substring for a string, false for anything else.
   *
   * <p>{@code not_contains} is the plain negation of this, which is how the
   * original behaved: a value that is neither a list nor a string "contains"
   * nothing, and therefore "not contains" everything.
   */
  private static boolean contains(Object value, JsonNode target) {
    if (value instanceof List<?> list) {
      return list.stream().anyMatch(item -> sameValue(item, target));
    }
    if (value instanceof String text) {
      return text.contains(target.asText(""));
    }
    return false;
  }

  /** Strict equality, comparing the way JavaScript's {@code ===} would. */
  private static boolean sameValue(Object value, JsonNode target) {
    if (target.isNumber()) {
      return value instanceof Number n && n.doubleValue() == target.asDouble();
    }
    if (target.isBoolean()) {
      return value instanceof Boolean b && b == target.asBoolean();
    }
    if (target.isNull()) {
      return value == null;
    }
    return value instanceof String text && text.equals(target.asText(""));
  }

  private static double number(Object value) {
    if (value instanceof Number n) {
      return n.doubleValue();
    }
    try {
      return value == null ? Double.NaN : Double.parseDouble(String.valueOf(value));
    } catch (NumberFormatException e) {
      return Double.NaN;
    }
  }
}
