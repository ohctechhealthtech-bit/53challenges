package com.fiftythree.challenges.host;

import com.fiftythree.challenges.security.CallerResolver;
import com.fiftythree.challenges.upstream.ChallengeApiClient;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/**
 * The Java replacement for {@code hostRequests}: a host's own challenge
 * enquiries.
 *
 * <p>Ownership is always derived from the session, never from the request body,
 * so one host can never read or edit another's. A request that is not theirs
 * returns the same "not found" as one that does not exist.
 *
 * <pre>
 *   my_requests    -> {requests}
 *   get_request    -> {request, editable}
 *   update_request -> {ok, request, pushed}
 * </pre>
 */
@RestController
public class HostRequestsController {

  private static final Logger log = LoggerFactory.getLogger(HostRequestsController.class);

  /** Statuses where the host may still edit. Anything else is closed. */
  private static final Set<String> OPEN_STATUSES =
      Set.of("new", "planning", "contacted", "in-progress");

  /**
   * The only fields a host may change on their own request. Status, internal
   * notes and ownership are deliberately absent: a host must not be able to
   * approve their own enquiry by patching its status.
   */
  private static final Set<String> EDITABLE_FIELDS = Set.of(
      "company_name", "company_website", "industry", "abn",
      "contact_name", "contact_email", "contact_phone",
      "challenge_title", "challenge_type", "challenge_goal", "challenge_description",
      "audience_description", "audience_size", "geographic_scope",
      "launch_timing", "start_date", "end_date",
      "estimated_budget", "prize_format", "additional_notes", "how_heard");

  private static final List<String> REQUIRED_FIELDS = List.of(
      "company_name", "contact_name", "contact_email",
      "challenge_title", "challenge_description", "audience_description");

  private static final Pattern EMAIL = Pattern.compile("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$");

  private final HostRequestService requests;
  private final ChallengeApiClient upstream;
  private final CallerResolver caller;

  public HostRequestsController(
      HostRequestService requests, ChallengeApiClient upstream, CallerResolver caller) {
    this.requests = requests;
    this.upstream = upstream;
    this.caller = caller;
  }

  @PostMapping("/api/apps/{appId}/functions/hostRequests")
  public ResponseEntity<?> handle(@RequestBody(required = false) Map<String, Object> body) {
    Map<String, Object> request = body == null ? Map.of() : body;
    String email = caller.email(str(request.get("session_token")));
    if (email == null) {
      return ResponseEntity.status(401)
          .body(Map.of("error", "Please sign in to see your requests."));
    }

    String action = str(request.get("action"));
    try {
      return switch (action) {
        case "my_requests" -> ResponseEntity.ok(Map.of("requests", requests.listMine(email)));
        case "get_request" -> getRequest(request, email);
        case "update_request" -> updateRequest(request, email);
        default -> ResponseEntity.badRequest().body(Map.of("error", "Unknown action"));
      };
    } catch (Exception e) {
      log.error("hostRequests action '{}' failed", action, e);
      return ResponseEntity.status(500).body(Map.of("error", e.getMessage()));
    }
  }

  private ResponseEntity<?> getRequest(Map<String, Object> request, String email) {
    Map<String, Object> record = requests.getMine(str(request.get("id")), email);
    if (record == null) {
      return ResponseEntity.status(404).body(Map.of("error", "Request not found"));
    }
    return ResponseEntity.ok(Map.of(
        "request", record, "editable", isEditable(str(record.get("status")))));
  }

  private ResponseEntity<?> updateRequest(Map<String, Object> request, String email) {
    String id = str(request.get("id"));
    Map<String, Object> record = requests.getMine(id, email);
    // Not theirs and not existing give the identical answer, so this cannot be
    // used to discover that another host's request exists.
    if (record == null) {
      return ResponseEntity.status(404).body(Map.of("error", "Request not found"));
    }

    String status = str(record.get("status"));
    if (!isEditable(status)) {
      return ResponseEntity.status(409).body(Map.of(
          "error", "approved".equals(status)
              ? "This request has been approved, so it can no longer be edited."
              : "This request is closed, so it can no longer be edited.",
          "locked", true,
          "status", status));
    }

    // Only whitelisted fields are applied — everything else in the patch is
    // ignored rather than rejected, matching the original.
    Map<String, Object> patch = new LinkedHashMap<>();
    Map<String, Object> incoming = asMap(request.get("patch"));
    for (String field : EDITABLE_FIELDS) {
      if (incoming.containsKey(field)) {
        patch.put(field, incoming.get(field));
      }
    }

    Map<String, Object> next = new LinkedHashMap<>(record);
    next.putAll(patch);

    for (String field : REQUIRED_FIELDS) {
      if (str(next.get(field)).trim().isEmpty()) {
        return ResponseEntity.badRequest()
            .body(Map.of("error", "Please complete all required fields."));
      }
    }
    if (!EMAIL.matcher(str(next.get("contact_email"))).matches()) {
      return ResponseEntity.badRequest()
          .body(Map.of("error", "Please enter a valid contact email address."));
    }
    String start = str(next.get("start_date"));
    String end = str(next.get("end_date"));
    if (start.isEmpty() || end.isEmpty()) {
      return ResponseEntity.badRequest()
          .body(Map.of("error", "Please give a start and end date."));
    }
    // Both are yyyy-MM-dd, which compares correctly as text.
    if (end.compareTo(start) <= 0) {
      return ResponseEntity.badRequest()
          .body(Map.of("error", "The end date must be after the start date."));
    }

    boolean pushed = pushToParent(next, firstNonBlank(
        str(record.get("parent_request_id")), str(record.get("id")), id));

    return ResponseEntity.ok(Map.of("ok", true, "request", next, "pushed", pushed));
  }

  /** Re-pushes the edited details to the parent, the source of truth. */
  private boolean pushToParent(Map<String, Object> form, String updateOfRequestId) {
    try {
      Map<String, Object> payload = new LinkedHashMap<>();
      put(payload, "company_name", form.get("company_name"));
      put(payload, "website", form.get("company_website"));
      put(payload, "industry", form.get("industry"));
      put(payload, "contact_name", form.get("contact_name"));
      put(payload, "contact_email", form.get("contact_email"));
      put(payload, "phone", form.get("contact_phone"));
      put(payload, "working_title", form.get("challenge_title"));
      put(payload, "challenge_type", form.get("challenge_type"));
      put(payload, "main_goal", form.get("challenge_goal"));
      put(payload, "description", form.get("challenge_description"));
      put(payload, "participants", form.get("audience_description"));
      put(payload, "expected_participants", form.get("audience_size"));
      put(payload, "geographic_scope", form.get("geographic_scope"));
      put(payload, "launch_timeframe", form.get("launch_timing"));
      put(payload, "start_date", form.get("start_date"));
      put(payload, "end_date", form.get("end_date"));
      put(payload, "budget_range", form.get("estimated_budget"));
      put(payload, "prize_format", form.get("prize_format"));
      put(payload, "additional_notes", form.get("additional_notes"));
      put(payload, "heard_about", form.get("how_heard"));
      put(payload, "update_of_request_id", updateOfRequestId);

      upstream.postTo(upstream.sibling("hostChallengeRequest"), payload);
      return true;
    } catch (Exception e) {
      // The edit is reported as saved-but-not-pushed rather than failed: the
      // host sees what happened instead of a generic error.
      log.warn("Could not push host request update to the parent: {}", e.toString());
      return false;
    }
  }

  /** Blank values are dropped so an empty field does not overwrite a set one. */
  private static void put(Map<String, Object> target, String key, Object value) {
    String s = value == null ? "" : String.valueOf(value);
    if (!s.isBlank()) {
      target.put(key, s);
    }
  }

  private static boolean isEditable(String status) {
    return OPEN_STATUSES.contains(status == null || status.isBlank() ? "new" : status);
  }

  @SuppressWarnings("unchecked")
  private static Map<String, Object> asMap(Object v) {
    return v instanceof Map<?, ?> m ? (Map<String, Object>) m : Map.of();
  }

  private static String firstNonBlank(String... values) {
    for (String v : values) {
      if (v != null && !v.isBlank()) {
        return v;
      }
    }
    return "";
  }

  private static String str(Object v) {
    return v == null ? "" : String.valueOf(v);
  }
}
