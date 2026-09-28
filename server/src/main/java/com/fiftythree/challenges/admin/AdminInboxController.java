package com.fiftythree.challenges.admin;

import com.fiftythree.challenges.security.CallerResolver;
import com.fiftythree.challenges.support.ApiErrors;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/**
 * The Java replacement for {@code adminInbox}: the "needs your attention"
 * summary. The dashboard tiles and the waiting-longest list both come from this
 * one response, so they cannot disagree.
 */
@RestController
public class AdminInboxController {

  private static final Logger log = LoggerFactory.getLogger(AdminInboxController.class);

  /** How many of the oldest waiting items to surface. */
  private static final int WAITING_LIMIT = 8;

  private final AdminQueueService queues;
  private final CallerResolver caller;

  public AdminInboxController(AdminQueueService queues, CallerResolver caller) {
    this.queues = queues;
    this.caller = caller;
  }

  @PostMapping("/api/apps/{appId}/functions/adminInbox")
  public ResponseEntity<?> handle(@RequestBody(required = false) Map<String, Object> body) {
    Map<String, Object> request = body == null ? Map.of() : body;
    String sessionToken = str(request.get("session_token"));

    if (caller.email(sessionToken) == null) {
      return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
    }
    if (!caller.isAdmin(sessionToken)) {
      return ResponseEntity.status(403).body(Map.of("error", "Admin only"));
    }

    try {
      List<Map<String, Object>> built = queues.build();
      int total = built.stream().mapToInt(q -> (int) q.get("count")).sum();

      // Flattened to the oldest items across every queue, so the admin sees
      // what has been waiting longest regardless of which queue it sits in.
      List<Map<String, Object>> waiting = new ArrayList<>();
      for (Map<String, Object> queue : built) {
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> items = (List<Map<String, Object>>) queue.get("items");
        for (Map<String, Object> item : items) {
          String since = String.valueOf(item.get("since"));
          if (since.isEmpty() || "null".equals(since)) {
            // Something with no timestamp cannot be ranked by age, and guessing
            // would push real items off the list.
            continue;
          }
          Map<String, Object> row = new LinkedHashMap<>(item);
          row.put("queue", queue.get("key"));
          row.put("type", queue.get("label"));
          row.put("link", queue.get("link"));
          waiting.add(row);
        }
      }
      // Oldest first, and ISO-8601 sorts chronologically as text.
      waiting.sort(Comparator.comparing(r -> String.valueOf(r.get("since"))));

      return ResponseEntity.ok(Map.of(
          "queues", built,
          "total", total,
          "waiting", waiting.size() > WAITING_LIMIT
              ? waiting.subList(0, WAITING_LIMIT)
              : waiting));
    } catch (Exception e) {
      log.error("adminInbox failed", e);
      return ApiErrors.internal(e);
    }
  }

  private static String str(Object v) {
    return v == null ? "" : String.valueOf(v);
  }
}
