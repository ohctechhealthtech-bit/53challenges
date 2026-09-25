package com.fiftythree.challenges.host;

import com.fasterxml.jackson.databind.JsonNode;
import com.fiftythree.challenges.upstream.ChallengeApiClient;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * A host's own challenge enquiries and applications, read from the parent app.
 *
 * <p>This app keeps no local copy. The parent is the single source of truth, so
 * a request deleted there disappears here immediately with nothing to sync —
 * and a host can never see a stale record the parent has already removed.
 *
 * <p>Field names on the parent differ from this app's PartnerInquiry shape, so
 * {@link #fromParentRequest} maps them back to what the UI expects.
 */
@Service
public class HostRequestService {

  private static final Logger log = LoggerFactory.getLogger(HostRequestService.class);

  private final ChallengeApiClient upstream;

  public HostRequestService(ChallengeApiClient upstream) {
    this.upstream = upstream;
  }

  /**
   * Every request belonging to one host, newest first.
   *
   * <p>Filtered by {@code contact_email} against the <em>verified</em> session
   * address, never one supplied by the caller — the parent returns every host's
   * requests, so this filter is what keeps one host from reading another's.
   */
  public List<Map<String, Object>> listMine(String email) {
    String wanted = norm(email);
    if (wanted.isEmpty()) {
      return List.of();
    }

    JsonNode data = callParent("hostRequests.list", Map.of());
    List<Map<String, Object>> out = new ArrayList<>();
    for (JsonNode r : data.path("requests")) {
      if (!wanted.equals(norm(r.path("contact_email").asText("")))) {
        continue;
      }
      out.add(fromParentRequest(r));
    }
    out.sort(Comparator.comparing(
        (Map<String, Object> r) -> String.valueOf(r.getOrDefault("submitted_at", ""))).reversed());
    return out;
  }

  /** One request by id, or null when it is not this host's. */
  public Map<String, Object> getMine(String id, String email) {
    if (id == null || id.isBlank()) {
      return null;
    }
    JsonNode request = callParent("hostRequests.get", Map.of("id", id)).path("request");
    if (request.isMissingNode() || request.isNull()) {
      return null;
    }
    // Ownership is checked here, and a mismatch returns null so the caller can
    // answer "not found" — the same answer as a request that does not exist,
    // so this cannot be used to discover other hosts' request ids.
    if (!norm(email).isEmpty()
        && !norm(email).equals(norm(request.path("contact_email").asText("")))) {
      return null;
    }
    return fromParentRequest(request);
  }

  private JsonNode callParent(String action, Map<String, Object> params) {
    ChallengeApiClient.UpstreamResponse res = upstream.postTo(
        upstream.sibling("adminChallengeApi"),
        Map.of("action", action, "params", params));
    JsonNode body = res.body();
    if (body.path("ok").isBoolean() && !body.path("ok").asBoolean()) {
      String message = body.path("error").path("message").asText("Parent API error");
      throw new IllegalStateException(message);
    }
    return body.path("data").isObject() ? body.path("data") : body;
  }

  /** Parent request shape to this app's PartnerInquiry field names. */
  public static Map<String, Object> fromParentRequest(JsonNode r) {
    Map<String, Object> m = new LinkedHashMap<>();
    m.put("id", r.path("id").asText(""));
    m.put("parent_request_id", r.path("id").asText(""));
    m.put("company_name", r.path("company_name").asText(""));
    m.put("company_website", r.path("website").asText(""));
    m.put("industry", r.path("industry").asText(""));
    m.put("abn", r.path("abn").asText(""));
    m.put("contact_name", r.path("contact_name").asText(""));
    m.put("contact_email", r.path("contact_email").asText(""));
    m.put("contact_phone", r.path("phone").asText(""));
    m.put("challenge_title", r.path("working_title").asText(""));
    m.put("challenge_type", r.path("challenge_type").asText(""));
    m.put("challenge_goal", r.path("main_goal").asText(""));
    m.put("challenge_description", r.path("description").asText(""));
    m.put("audience_description", r.path("participants").asText(""));
    m.put("audience_size", r.path("expected_participants").asText(""));
    m.put("geographic_scope", r.path("geographic_scope").asText(""));
    m.put("launch_timing", r.path("launch_timeframe").asText(""));
    m.put("start_date", toDateOnly(r.path("start_date").asText("")));
    m.put("end_date", toDateOnly(r.path("end_date").asText("")));
    m.put("estimated_budget", r.path("budget_range").asText(""));
    m.put("prize_format", r.path("prize_format").asText(""));
    m.put("additional_notes", r.path("additional_notes").asText(""));
    m.put("how_heard", r.path("heard_about").asText(""));
    m.put("status", firstNonBlank(r.path("status").asText(""), "new"));
    m.put("submitted_at", r.path("submitted_at").asText(""));
    m.put("group", r.path("group").asText(""));
    m.put("converted_challenge_id", firstNonBlank(
        r.path("challenge_id").asText(""), r.path("converted_challenge_id").asText("")));
    return m;
  }

  /** A yyyy-MM-dd date, however the parent expressed it. */
  static String toDateOnly(String v) {
    if (v == null || v.isBlank()) {
      return "";
    }
    if (v.matches("\\d{4}-\\d{2}-\\d{2}")) {
      return v;
    }
    // An ISO timestamp starts with the date, so the prefix is taken rather than
    // parsed — parsing would apply a timezone and could shift the day.
    if (v.length() >= 10 && v.charAt(4) == '-' && v.charAt(7) == '-') {
      return v.substring(0, 10);
    }
    return "";
  }

  private static String firstNonBlank(String... values) {
    for (String v : values) {
      if (v != null && !v.isBlank()) {
        return v;
      }
    }
    return "";
  }

  private static String norm(String v) {
    return v == null ? "" : v.trim().toLowerCase();
  }
}
