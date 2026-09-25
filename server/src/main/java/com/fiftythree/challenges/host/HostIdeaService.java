package com.fiftythree.challenges.host;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fiftythree.challenges.upstream.ChallengeApiClient;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * Challenge ideas submitted through "Tell us your idea", which live on the
 * parent app.
 *
 * <p>The wizard's structured answers are smuggled inside the free-text
 * {@code additional_notes} field, after a marker, because the parent's schema
 * has nowhere else to put them. {@link #fromIdeaRecord} splits them back out.
 * It is not a design worth defending, but it is the storage that exists, and
 * changing it means changing the parent app.
 */
@Service
public class HostIdeaService {

  private static final Logger log = LoggerFactory.getLogger(HostIdeaService.class);

  /** Must match the parent byte for byte, or the answers cannot be recovered. */
  private static final String MARKER = "\n\n--- wizard details (do not edit) ---\n";

  private static final Set<String> IDEA_STATUSES =
      Set.of("new", "in_review", "contacted", "accepted", "declined");

  private final ChallengeApiClient upstream;
  private final ObjectMapper mapper;

  public HostIdeaService(ChallengeApiClient upstream, ObjectMapper mapper) {
    this.upstream = upstream;
    this.mapper = mapper;
  }

  /**
   * Posts a public "tell us your idea" enquiry to the parent.
   *
   * <p>The parent's own {@code hostChallengeRequest} is the store of record —
   * nothing is kept locally, so a deletion there is reflected here at once and
   * there is no second copy to drift out of step.
   *
   * @return the parent's request id, or empty when it did not accept
   */
  public String createEnquiry(Map<String, Object> body) {
    try {
      var response = upstream.postTo(
          upstream.sibling("hostChallengeRequest"), toIdeaPayload(body));
      JsonNode data = response.body();
      return firstNonBlank(
          data.path("request_id").asText(""),
          data.path("id").asText(""));
    } catch (Exception e) {
      log.warn("Could not create enquiry on the parent: {}", e.toString());
      return "";
    }
  }

  /** Posts a full host application to the parent, returning its request id. */
  public String pushRequestToParent(Map<String, Object> form) {
    try {
      var response = upstream.postTo(
          upstream.sibling("hostChallengeRequest"), toRequestPayload(form));
      JsonNode data = response.body();
      return firstNonBlank(
          data.path("request_id").asText(""),
          data.path("id").asText(""));
    } catch (Exception e) {
      log.warn("Could not push host request to the parent: {}", e.toString());
      return "";
    }
  }

  /** The ready-to-run templates a host can start from, in curator order. */
  public List<Map<String, Object>> activeTemplates() {
    try {
      JsonNode body = upstream.getFrom(upstream.sibling("ideaTemplatesApi"),
          "templates", Map.of("status", "active")).body();
      JsonNode rows = body.path("templates");
      if (!rows.isArray()) {
        return List.of();
      }
      List<Map<String, Object>> out = new ArrayList<>();
      for (JsonNode t : rows) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("id", t.path("id").asText(""));
        row.put("template_name", t.path("template_name").asText(""));
        row.put("summary", t.path("summary").asText(""));
        row.put("entry_type", t.path("entry_type").asText(""));
        row.put("category", t.path("category").asText(""));
        row.put("image_url", t.path("image_url").asText(""));
        row.put("status", t.path("status").asText("active"));
        row.put("sort_order", t.path("sort_order").asDouble(0));
        out.add(row);
      }
      out.sort((a, b) -> Double.compare(
          (Double) a.getOrDefault("sort_order", 0d),
          (Double) b.getOrDefault("sort_order", 0d)));
      return out;
    } catch (Exception e) {
      log.warn("Could not list idea templates: {}", e.toString());
      return List.of();
    }
  }

  /**
   * The enquiry payload the parent expects.
   *
   * <p>The wizard collects far more than the parent's schema has columns for,
   * so the full answer set is appended to {@code additional_notes} after
   * {@link #MARKER} as JSON. {@link #fromIdeaRecord} reads it back out. It is
   * ugly, and it is what lets the wizard evolve without a schema change on a
   * system this app does not own.
   */
  private Map<String, Object> toIdeaPayload(Map<String, Object> body) {
    Map<String, Object> answers = new LinkedHashMap<>();
    answers.put("source", "tell_us_your_idea");
    for (String field : IDEA_TEXT_FIELDS) {
      answers.put(field, text(body.get(field)));
    }
    for (String field : IDEA_LIST_FIELDS) {
      answers.put(field, list(body.get(field)));
    }
    answers.put("for_own_organisation", !Boolean.FALSE.equals(body.get("for_own_organisation")));

    String organisation = text(answers.get("organisation_name"));
    String name = text(answers.get("name"));
    String templateName = text(answers.get("template_name"));

    Map<String, Object> payload = new LinkedHashMap<>();
    payload.put("company_name", organisation.isEmpty() ? name : organisation);
    payload.put("contact_name", name);
    payload.put("contact_email", text(answers.get("email")));
    payload.put("phone", text(answers.get("phone")));
    payload.put("working_title", text(body.get("challenge_title")));
    payload.put("description", text(body.get("challenge_description")));
    payload.put("challenge_type", text(answers.get("activity_type")));
    payload.put("main_goal", text(answers.get("primary_objective")));
    String beneficiary = text(answers.get("beneficiary_name"));
    payload.put("participants",
        beneficiary.isEmpty() ? text(answers.get("org_type")) : beneficiary);
    payload.put("expected_participants", text(answers.get("participants")));
    payload.put("geographic_scope", text(answers.get("reach")));
    payload.put("launch_timeframe", text(answers.get("timing")));
    payload.put("budget_range", text(answers.get("budget")));
    payload.put("prize_format", text(answers.get("prize_pool")));
    payload.put("heard_about", templateName.isEmpty() ? "" : "Template: " + templateName);
    payload.put("source_app", "53-challenges");
    payload.put("additional_notes",
        text(answers.get("extra_notes")) + MARKER + write(answers));
    return payload;
  }

  /** The application payload, which maps onto the parent's own field names. */
  private Map<String, Object> toRequestPayload(Map<String, Object> form) {
    Map<String, Object> payload = new LinkedHashMap<>();
    for (String field : REQUEST_FIELDS) {
      Object value = form.get(field);
      if (value != null) {
        payload.put(field, value);
      }
    }
    // The parent keys the working title differently from the form.
    payload.putIfAbsent("working_title", text(form.get("challenge_title")));
    payload.putIfAbsent("description", text(form.get("challenge_description")));
    payload.put("source_app", "53-challenges");
    return payload;
  }

  private static final List<String> IDEA_TEXT_FIELDS = List.of(
      "name", "email", "phone", "organisation_name", "org_kind", "org_state",
      "org_abn", "org_type", "beneficiary_name", "beneficiary_notes",
      "activity_type", "participants", "reach", "winner_method", "scope",
      "timing", "prize_pool", "budget", "extra_notes", "primary_objective",
      "participant_next_action", "rules_notes", "judging_source",
      "platform_judges_notes", "template_id", "template_name");

  private static final List<String> IDEA_LIST_FIELDS = List.of(
      "age_groups", "secondary_objectives", "rules_expectations", "invited_judges");

  private static final List<String> REQUEST_FIELDS = List.of(
      "company_name", "website", "industry", "contact_name", "contact_email",
      "phone", "working_title", "challenge_type", "main_goal", "description",
      "participants", "expected_participants", "geographic_scope",
      "launch_timeframe", "start_date", "end_date", "voting_end_date",
      "cover_image", "category", "age_divisions", "accepted_entry_types",
      "budget_range", "prize_format", "additional_notes", "heard_about");

  private static String text(Object value) {
    return value == null ? "" : String.valueOf(value).trim();
  }

  private static Object list(Object value) {
    return value instanceof List<?> ? value : List.of();
  }

  private static String firstNonBlank(String a, String b) {
    return a != null && !a.isBlank() ? a : (b == null ? "" : b);
  }

  private String write(Object value) {
    try {
      return mapper.writeValueAsString(value);
    } catch (Exception e) {
      return "{}";
    }
  }

  /**
   * Moves an idea through its review queue on the parent.
   *
   * <p>Marked read at the same time: an admin who has just set a status has
   * evidently seen it, and leaving it unread would keep it in the "new" count.
   */
  public boolean setStatus(String ideaId, String status) {
    try {
      var response = upstream.postTo(upstream.sibling("hostIdeaApi"),
          java.util.Map.of("action", "set_status", "id", ideaId,
              "status", status, "is_read", true));
      return response.status() < 400 && response.body().path("success").asBoolean(true);
    } catch (Exception e) {
      log.warn("Could not set idea {} to {}: {}", ideaId, status, e.toString());
      return false;
    }
  }

  /** Every idea the parent holds, mapped into this app's shape. */
  public List<Map<String, Object>> list(int limit) {
    try {
      JsonNode body = upstream.getFrom(upstream.sibling("hostIdeaApi"), "ideas",
          Map.of("limit", String.valueOf(limit))).body();
      JsonNode rows = body.path("ideas").isArray() ? body.path("ideas") : body.path("requests");
      if (!rows.isArray()) {
        return List.of();
      }
      List<Map<String, Object>> out = new ArrayList<>();
      for (JsonNode rec : rows) {
        out.add(fromIdeaRecord(rec));
      }
      return out;
    } catch (Exception e) {
      log.warn("Could not list challenge ideas: {}", e.toString());
      return List.of();
    }
  }

  /** One parent idea record, with the wizard answers recovered. */
  public Map<String, Object> fromIdeaRecord(JsonNode rec) {
    String notes = rec.path("additional_notes").asText("");
    int at = notes.indexOf(MARKER);

    Map<String, Object> answers = new LinkedHashMap<>();
    if (at >= 0) {
      try {
        JsonNode parsed = mapper.readTree(notes.substring(at + MARKER.length()));
        parsed.fields().forEachRemaining(f -> answers.put(f.getKey(), f.getValue().asText()));
      } catch (Exception e) {
        // Malformed answers cost the structured detail, not the whole record —
        // the idea itself is still worth showing.
        log.debug("Could not parse wizard answers on idea {}: {}",
            rec.path("id").asText(""), e.toString());
      }
    }
    String extra = at >= 0 ? notes.substring(0, at) : notes;

    answers.putIfAbsent("name", rec.path("contact_name").asText(""));
    answers.putIfAbsent("email", rec.path("contact_email").asText(""));
    answers.putIfAbsent("phone", rec.path("phone").asText(""));
    answers.putIfAbsent("organisation_name", rec.path("company_name").asText(""));
    answers.merge("extra_notes", extra, (existing, fresh) ->
        String.valueOf(existing).isBlank() ? fresh : existing);

    String status = rec.path("status").asText("new");

    Map<String, Object> out = new LinkedHashMap<>();
    out.put("id", rec.path("id").asText(""));
    out.put("challenge_title", rec.path("working_title").asText(""));
    out.put("challenge_description", rec.path("description").asText(""));
    // An unrecognised status is treated as new rather than shown raw: the UI
    // only knows how to render the five it expects.
    out.put("review_status", IDEA_STATUSES.contains(status) ? status : "new");
    out.put("is_read", rec.path("is_read").asBoolean(false));
    out.put("created_date", firstNonBlank(
        rec.path("submitted_at").asText(""), rec.path("created_date").asText("")));
    out.put("answers", answers);
    return out;
  }

  private static String firstNonBlank(String... values) {
    for (String v : values) {
      if (v != null && !v.isBlank()) {
        return v;
      }
    }
    return "";
  }
}
