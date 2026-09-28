package com.fiftythree.challenges.judging;

import com.fasterxml.jackson.databind.JsonNode;
import com.fiftythree.challenges.admin.JudgeRepo;
import com.fiftythree.challenges.entity.JudgeProfileEntity;
import com.fiftythree.challenges.security.CallerResolver;
import com.fiftythree.challenges.support.JsonColumn;
import com.fiftythree.challenges.upstream.ChallengeApiClient;
import com.fiftythree.challenges.upstream.ChallengeApiClient.UpstreamResponse;
import com.fiftythree.challenges.support.ApiErrors;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
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
 * The Java replacement for {@code judgesMaster}: the external judges register,
 * merged with judges approved locally in this app.
 *
 * <p>Reads are public — visitors browsing the host wizard see the panel before
 * they sign in — so <b>judge email addresses are stripped for anyone who is not
 * an admin</b>. A host picking a panel needs names, levels and disciplines, not
 * contact details for every judge on the platform.
 */
@RestController
public class JudgesMasterController {

  private static final Logger log = LoggerFactory.getLogger(JudgesMasterController.class);

  private static final Set<String> READ_ACTIONS = Set.of("options", "judges", "judge");
  private static final Set<String> ADMIN_ACTIONS = Set.of("upsert", "set_active");
  private static final List<String> GET_PARAMS =
      List.of("active", "level", "discipline", "limit", "skip", "id", "email");

  /** Judge statuses this app considers approved to sit on a panel. */
  private static final Set<String> LOCAL_APPROVED = Set.of("approved", "active");

  private final ChallengeApiClient upstream;
  private final JudgeRepo judges;
  private final JsonColumn json;
  private final CallerResolver caller;

  public JudgesMasterController(
      ChallengeApiClient upstream, JudgeRepo judges, JsonColumn json, CallerResolver caller) {
    this.upstream = upstream;
    this.judges = judges;
    this.json = json;
    this.caller = caller;
  }

  @PostMapping("/api/apps/{appId}/functions/judgesMaster")
  public ResponseEntity<?> handle(@RequestBody(required = false) Map<String, Object> body) {
    Map<String, Object> request = body == null ? Map.of() : body;
    String action = firstNonBlank(str(request.get("action")), "judges");
    String sessionToken = str(request.get("session_token"));
    String email = caller.email(sessionToken);
    boolean isAdmin = caller.isAdmin(sessionToken);

    try {
      if (READ_ACTIONS.contains(action)) {
        return read(action, request, isAdmin);
      }

      // Everything else needs a session.
      if (email == null) {
        return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
      }

      if (ADMIN_ACTIONS.contains(action)) {
        if (!isAdmin) {
          return ResponseEntity.status(403).body(Map.of("error", "Forbidden"));
        }
        Map<String, Object> payload = new LinkedHashMap<>(request);
        payload.remove("session_token");
        payload.put("action", action);
        return ResponseEntity.ok(
            upstream.postTo(upstream.sibling("judgesMasterApi"), payload).body());
      }

      if ("save_host_judges".equals(action)) {
        return ResponseEntity.ok(Map.of(
            "success", true, "judges", upsertHostJudges(request.get("judges"))));
      }

      return ResponseEntity.badRequest().body(Map.of("error", "Unknown action: " + action));
    } catch (Exception e) {
      log.error("judgesMaster action '{}' failed", action, e);
      return ApiErrors.internal(e);
    }
  }

  private ResponseEntity<?> read(String action, Map<String, Object> request, boolean isAdmin) {
    Map<String, String> params = new LinkedHashMap<>();
    for (String key : GET_PARAMS) {
      String value = str(request.get(key));
      if (!value.isEmpty()) {
        params.put(key, value);
      }
    }

    UpstreamResponse res =
        upstream.getFrom(upstream.sibling("judgesMasterApi"), action, params);

    if (!"judges".equals(action)) {
      return ResponseEntity.ok(res.body());
    }

    // The list must also include judges approved in THIS app that were never
    // pushed to the external register — otherwise they silently vanish from
    // the admin list and cannot be put on a panel.
    List<Map<String, Object>> merged = new ArrayList<>();
    Set<String> knownEmails = new LinkedHashSet<>();
    Set<String> seenIds = new LinkedHashSet<>();

    for (JsonNode j : res.body().path("judges")) {
      String id = j.path("id").asText("");
      if (id.isEmpty() || !seenIds.add(id)) {
        // The register can return the same judge in both a list and a filtered
        // query; one row each is what the UI expects.
        continue;
      }
      knownEmails.add(j.path("email").asText("").toLowerCase());
      merged.add(toJudge(j, isAdmin));
    }

    for (JudgeProfileEntity p : judges.findAll()) {
      if (!LOCAL_APPROVED.contains(nz(p.getStatus()))) {
        continue;
      }
      String judgeEmail = nz(p.getEmail()).toLowerCase();
      if (judgeEmail.isEmpty() || knownEmails.contains(judgeEmail)) {
        continue;
      }
      if (!matchesFilters(p, params)) {
        continue;
      }
      if (!seenIds.add(p.getId())) {
        continue;
      }

      Map<String, Object> row = new LinkedHashMap<>();
      row.put("id", p.getId());
      row.put("name", p.getName());
      if (isAdmin) {
        row.put("email", p.getEmail());
      }
      List<String> approved = json.stringList(p.getApprovedCategories());
      row.put("disciplines", approved.isEmpty() ? json.stringList(p.getAppliedCategories()) : approved);
      row.put("level", "state");
      row.put("active", true);
      merged.add(row);
    }

    Map<String, Object> out = new LinkedHashMap<>();
    res.body().fields().forEachRemaining(f -> {
      if (!"judges".equals(f.getKey()) && !"count".equals(f.getKey())) {
        out.put(f.getKey(), f.getValue());
      }
    });
    out.put("judges", merged);
    out.put("count", merged.size());
    return ResponseEntity.ok(out);
  }

  /** Local judges must honour the same filters the register was queried with. */
  private boolean matchesFilters(JudgeProfileEntity p, Map<String, String> params) {
    // Locally approved judges are always active, so an explicit active=false
    // query excludes them all.
    if ("false".equals(params.get("active"))) {
      return false;
    }
    String level = params.get("level");
    if (level != null && !level.isBlank() && !"state".equals(level)) {
      return false;
    }
    String discipline = params.get("discipline");
    if (discipline != null && !discipline.isBlank()) {
      List<String> approved = json.stringList(p.getApprovedCategories());
      List<String> disciplines =
          approved.isEmpty() ? json.stringList(p.getAppliedCategories()) : approved;
      return disciplines.contains(discipline);
    }
    return true;
  }

  /** An upstream judge row, with the email withheld from non-admins. */
  private static Map<String, Object> toJudge(JsonNode j, boolean isAdmin) {
    Map<String, Object> row = new LinkedHashMap<>();
    j.fields().forEachRemaining(f -> {
      if ("email".equals(f.getKey()) && !isAdmin) {
        return;
      }
      row.put(f.getKey(), f.getValue().isTextual() ? f.getValue().textValue() : f.getValue());
    });
    return row;
  }

  /** Saves host-nominated judges into the register and returns their ids. */
  private List<Map<String, Object>> upsertHostJudges(Object raw) {
    List<?> list = raw instanceof List<?> l ? l : List.of();
    List<Map<String, Object>> saved = new ArrayList<>();

    for (Object o : list) {
      if (!(o instanceof Map<?, ?> j)) {
        continue;
      }
      String name = str(j.get("name")).trim();
      String email = str(j.get("email")).trim().toLowerCase();
      // Silently skipping an unusable row matches the original: a host
      // half-filling one judge should not lose the others they entered.
      if (name.isEmpty() || !email.contains("@")) {
        continue;
      }

      List<Object> disciplines = new ArrayList<>();
      if (j.get("disciplines") instanceof List<?> d) {
        disciplines.addAll(d);
      } else if (!str(j.get("expertise")).isEmpty()) {
        disciplines.add(str(j.get("expertise")));
      }

      Map<String, Object> payload = new LinkedHashMap<>();
      payload.put("action", "upsert");
      payload.put("name", name);
      payload.put("email", email);
      payload.put("disciplines", disciplines);
      payload.put("level", firstNonBlank(str(j.get("level")), "state"));
      payload.put("active", true);

      JsonNode out = upstream.postTo(upstream.sibling("judgesMasterApi"), payload).body();
      String id = out.path("judge").path("id").asText("");
      if (!id.isEmpty()) {
        saved.add(Map.of(
            "id", id,
            "name", out.path("judge").path("name").asText(""),
            "email", out.path("judge").path("email").asText(""),
            "created", out.path("created").asBoolean(false)));
      }
    }
    return saved;
  }

  private static String firstNonBlank(String... values) {
    for (String v : values) {
      if (v != null && !v.isBlank()) {
        return v;
      }
    }
    return "";
  }

  private static String nz(String v) {
    return v == null ? "" : v;
  }

  private static String str(Object v) {
    return v == null ? "" : String.valueOf(v);
  }
}
