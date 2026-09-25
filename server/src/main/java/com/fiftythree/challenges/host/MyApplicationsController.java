package com.fiftythree.challenges.host;

import com.fiftythree.challenges.admin.JudgeRepo;
import com.fiftythree.challenges.entity.JudgeProfileEntity;
import com.fiftythree.challenges.security.CallerResolver;
import com.fiftythree.challenges.support.JsonColumn;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/**
 * The Java replacement for {@code myApplications}: everything one person has
 * ever sent us, in one list, so they can see where each thing is up to.
 *
 * <ul>
 *   <li>challenge requests (the enquiry form)
 *   <li>challenge ideas ("Tell us your idea")
 *   <li>host applications (the paid application wizard)
 *   <li>judge applications
 * </ul>
 *
 * <p>Identity comes from the session throughout, so nobody can read anyone
 * else's applications.
 */
@RestController
public class MyApplicationsController {

  private static final Logger log = LoggerFactory.getLogger(MyApplicationsController.class);

  private static final int IDEA_LIMIT = 200;
  private static final int JUDGE_LIMIT = 20;

  private final HostRequestService requests;
  private final HostIdeaService ideas;
  private final JudgeRepo judges;
  private final JsonColumn json;
  private final CallerResolver caller;

  public MyApplicationsController(
      HostRequestService requests,
      HostIdeaService ideas,
      JudgeRepo judges,
      JsonColumn json,
      CallerResolver caller) {
    this.requests = requests;
    this.ideas = ideas;
    this.judges = judges;
    this.json = json;
    this.caller = caller;
  }

  @PostMapping("/api/apps/{appId}/functions/myApplications")
  public ResponseEntity<?> handle(@RequestBody(required = false) Map<String, Object> body) {
    Map<String, Object> request = body == null ? Map.of() : body;
    String email = caller.email(str(request.get("session_token")));
    if (email == null) {
      return ResponseEntity.status(401)
          .body(Map.of("error", "Please sign in to see your requests."));
    }

    try {
      List<Map<String, Object>> items = new ArrayList<>();
      Set<String> seenUpstreamIds = new HashSet<>();

      // Requests and host applications both come from the parent, which groups
      // them as 'enquiries' and 'proposals'. No local copy is kept, so a
      // deletion there is reflected here immediately.
      try {
        for (Map<String, Object> r : requests.listMine(email)) {
          String id = str(r.get("id"));
          if (!id.isEmpty()) {
            seenUpstreamIds.add(id);
          }
          boolean isProposal = "proposals".equals(str(r.get("group")));
          Map<String, Object> item = new LinkedHashMap<>();
          item.put("id", id);
          item.put("kind", isProposal ? "application" : "request");
          item.put("title", firstNonBlank(str(r.get("challenge_title")),
              isProposal ? "Challenge application" : "Challenge request"));
          item.put("subtitle", str(r.get("company_name")));
          item.put("status", firstNonBlank(str(r.get("status")),
              isProposal ? "intake_received" : "new"));
          item.put("submitted_at", str(r.get("submitted_at")));
          if (isProposal) {
            item.put("feedback", "");
          }
          items.add(item);
        }
      } catch (Exception e) {
        // The parent being unavailable costs these rows, not the whole list.
        log.warn("Could not load host requests for {}: {}", email, e.toString());
      }

      for (Map<String, Object> idea : ideas.list(IDEA_LIMIT)) {
        Map<?, ?> answers = idea.get("answers") instanceof Map<?, ?> m ? m : Map.of();
        if (!email.equals(norm(str(answers.get("email"))))) {
          continue;
        }
        // Only genuine "Tell us your idea" submissions: host applications and
        // enquiries also land on the parent and are already listed above.
        if (!"tell_us_your_idea".equals(str(answers.get("source")))) {
          continue;
        }
        if (seenUpstreamIds.contains(str(idea.get("id")))) {
          continue;
        }
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("id", idea.get("id"));
        item.put("kind", "idea");
        item.put("title", firstNonBlank(str(idea.get("challenge_title")), "Challenge idea"));
        item.put("subtitle", str(answers.get("organisation_name")));
        item.put("status", firstNonBlank(str(idea.get("review_status")), "new"));
        item.put("submitted_at", str(idea.get("created_date")));
        items.add(item);
      }

      for (JudgeProfileEntity j : judges.findByEmail(email, org.springframework.data.domain.Limit.of(JUDGE_LIMIT))) {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("id", j.getId());
        item.put("kind", "judge");
        item.put("title", "Judge application");
        item.put("subtitle", String.join(", ", json.stringList(j.getAppliedCategories())));
        item.put("status", firstNonBlank(j.getStatus(), "applicant"));
        item.put("submitted_at", j.getCreatedDate() == null ? "" : j.getCreatedDate().toString());
        items.add(item);
      }

      // Newest first. Every submitted_at is ISO-8601, which sorts
      // chronologically as text — no parsing, so no timezone to get wrong.
      items.sort(Comparator.comparing(
          (Map<String, Object> i) -> str(i.get("submitted_at"))).reversed());

      return ResponseEntity.ok(Map.of("items", items, "count", items.size()));
    } catch (Exception e) {
      log.error("myApplications failed", e);
      return ResponseEntity.status(500).body(Map.of("error", e.getMessage()));
    }
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

  private static String str(Object v) {
    return v == null ? "" : String.valueOf(v);
  }
}
