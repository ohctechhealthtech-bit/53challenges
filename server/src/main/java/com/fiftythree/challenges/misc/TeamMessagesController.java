package com.fiftythree.challenges.misc;

import com.fiftythree.challenges.entity.MessageEntity;
import com.fiftythree.challenges.security.CallerResolver;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/**
 * The Java replacement for {@code teamMessages}.
 *
 * <pre>
 *   my_unread  -> {unread}                    the caller's own unread replies
 *   mark_read  -> {ok, marked}                the caller's own thread
 *   threads    -> {threads, unread_total}     every thread            (admin)
 *   thread     -> {messages}                  one thread, marks read  (admin)
 *   reply      -> {ok, message}               team reply              (admin)
 * </pre>
 *
 * <p>Participant actions are scoped to the caller's own address, taken from the
 * session. Reading and writing another person's support thread is an admin
 * action, and the admin check happens before any query touches it.
 */
@RestController
public class TeamMessagesController {

  private static final Logger log = LoggerFactory.getLogger(TeamMessagesController.class);

  private final MessageQueryRepository messages;
  private final CallerResolver caller;

  public TeamMessagesController(MessageQueryRepository messages, CallerResolver caller) {
    this.messages = messages;
    this.caller = caller;
  }

  @PostMapping("/api/apps/{appId}/functions/teamMessages")
  public ResponseEntity<?> handle(@RequestBody(required = false) Map<String, Object> body) {
    Map<String, Object> request = body == null ? Map.of() : body;
    String sessionToken = str(request.get("session_token"));
    String email = caller.email(sessionToken);
    if (email == null) {
      return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
    }
    boolean isAdmin = caller.isAdmin(sessionToken);
    String action = str(request.get("action"));

    try {
      switch (action) {
        case "my_unread":
          return ResponseEntity.ok(Map.of("unread", messages.findUnreadFromTeam(email).size()));

        case "mark_read": {
          List<MessageEntity> unread = messages.findUnreadFromTeam(email);
          unread.forEach(m -> m.setRead(true));
          messages.saveAll(unread);
          return ResponseEntity.ok(Map.of("ok", true, "marked", unread.size()));
        }

        case "threads":
          return isAdmin ? threads() : adminOnly();

        case "thread": {
          if (!isAdmin) {
            return adminOnly();
          }
          String participant = str(request.get("participant_email"));
          if (participant.isEmpty()) {
            return ResponseEntity.badRequest()
                .body(Map.of("error", "participant_email required"));
          }
          List<MessageEntity> thread = messages.findThread(participant.toLowerCase());
          // Opening a thread marks the participant's messages as read — the
          // team has now seen them.
          List<MessageEntity> unread = messages.findUnreadFromUser(participant.toLowerCase());
          if (!unread.isEmpty()) {
            unread.forEach(m -> m.setRead(true));
            messages.saveAll(unread);
          }
          return ResponseEntity.ok(Map.of("messages", thread));
        }

        case "reply": {
          if (!isAdmin) {
            return adminOnly();
          }
          String participant = str(request.get("participant_email"));
          String text = str(request.get("body")).trim();
          if (participant.isEmpty() || text.isEmpty()) {
            return ResponseEntity.badRequest()
                .body(Map.of("error", "participant_email and body are required"));
          }
          MessageEntity m = new MessageEntity();
          m.setId(UUID.randomUUID().toString().replace("-", "").substring(0, 24));
          m.setBody(text);
          m.setSender("team");
          m.setParticipantEmail(participant);
          m.setParticipantName(str(request.get("participant_name")));
          m.setRead(false);
          m.setCreatedDate(Instant.now());
          m.setUpdatedDate(Instant.now());
          m.setIsSample(false);
          return ResponseEntity.ok(Map.of("ok", true, "message", messages.save(m)));
        }

        default:
          return ResponseEntity.badRequest().body(Map.of("error", "Unknown action"));
      }
    } catch (Exception e) {
      log.error("teamMessages action '{}' failed", action, e);
      return ResponseEntity.status(500).body(Map.of("error", e.getMessage()));
    }
  }

  /** One row per participant, summarising their thread. */
  private ResponseEntity<?> threads() {
    Map<String, Map<String, Object>> byParticipant = new LinkedHashMap<>();

    // Newest first, so the first message seen for a participant is the latest
    // and becomes the thread's preview.
    for (MessageEntity m : messages.findAllNewestFirst()) {
      String email = nz(m.getParticipantEmail());
      if (email.isEmpty()) {
        // A legacy message with no participant belongs to no thread and would
        // otherwise create an empty one.
        continue;
      }
      Map<String, Object> t = byParticipant.computeIfAbsent(email, k -> {
        Map<String, Object> fresh = new LinkedHashMap<>();
        fresh.put("participant_email", email);
        fresh.put("participant_name", nz(m.getParticipantName()));
        fresh.put("last_body", nz(m.getBody()));
        fresh.put("last_sender", nz(m.getSender()).isEmpty() ? "user" : m.getSender());
        fresh.put("last_at", m.getCreatedDate());
        fresh.put("unread", 0);
        fresh.put("total", 0);
        return fresh;
      });

      t.put("total", (int) t.get("total") + 1);
      if (str(t.get("participant_name")).isEmpty() && !nz(m.getParticipantName()).isEmpty()) {
        t.put("participant_name", m.getParticipantName());
      }
      if ("user".equals(nz(m.getSender())) && !Boolean.TRUE.equals(m.getRead())) {
        t.put("unread", (int) t.get("unread") + 1);
      }
    }

    List<Map<String, Object>> list = new ArrayList<>(byParticipant.values());
    int unreadTotal = list.stream().mapToInt(t -> (int) t.get("unread")).sum();
    return ResponseEntity.ok(Map.of("threads", list, "unread_total", unreadTotal));
  }

  private static ResponseEntity<?> adminOnly() {
    return ResponseEntity.status(403).body(Map.of("error", "Admin only"));
  }

  private static String nz(String v) {
    return v == null ? "" : v;
  }

  private static String str(Object v) {
    return v == null ? "" : String.valueOf(v);
  }
}
