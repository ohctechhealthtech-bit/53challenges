package com.fiftythree.challenges.engine;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fiftythree.challenges.entity.EntryEntity;
import com.fiftythree.challenges.security.CallerResolver;
import com.fiftythree.challenges.upstream.ChallengeApiClient;
import com.fiftythree.challenges.vote.VoteRepository;
import com.fiftythree.challenges.support.ApiErrors;
import java.time.Instant;
import java.util.ArrayList;
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
 * The Java replacement for the {@code challengeEngine} Base44 function.
 *
 * <p>Challenges themselves live ONLY in the upstream Challenge API — nothing
 * about a challenge is stored in this database — so list/get/create proxy
 * upstream. Entry moderation works on this app's own {@code entry} table.
 *
 * <pre>
 *   list             -> {challenges}                       (public)
 *   get              -> {challenge}                        (public)
 *   entries          -> {entries} with live vote counts    (public, filtered)
 *   create           -> {challenge}                        (admin)
 *   moderate_entry   -> {ok, entry}                        (admin)
 *   moderate_entries -> {ok, results, succeeded, failed}   (admin)
 * </pre>
 */
@RestController
public class ChallengeEngineController {

  private static final Logger log = LoggerFactory.getLogger(ChallengeEngineController.class);

  private static final Set<String> PUBLIC_ACTIONS = Set.of("list", "get", "entries");
  private static final Set<String> MODERATION_STATUSES = Set.of("approved", "rejected", "pending");
  private static final List<String> CHALLENGE_STATUSES =
      List.of("draft", "active", "voting", "completed", "archived");

  /**
   * Divisions that make an entrant a child in the eyes of the consent rules.
   * Kept alongside {@code is_minor} because either can be set independently.
   */
  private static final Set<String> CHILD_DIVISIONS = Set.of("children", "teens");

  private final EntryQueryRepository entries;
  private final VoteRepository votes;
  private final ChallengeApiClient upstream;
  private final CallerResolver caller;

  /**
   * Spring Boot's own mapper, injected rather than constructed.
   *
   * <p>A bare {@code new ObjectMapper()} has no JSR-310 module, so every entity
   * carrying an {@code Instant} — which is all of them, via created_date —
   * fails to serialise with "Java 8 date/time type not supported". The
   * auto-configured bean has it registered and writes ISO-8601 strings, which
   * is what the Base44 responses contained and what the client parses.
   */
  private final ObjectMapper mapper;

  public ChallengeEngineController(
      EntryQueryRepository entries,
      VoteRepository votes,
      ChallengeApiClient upstream,
      CallerResolver caller,
      ObjectMapper mapper) {
    this.entries = entries;
    this.votes = votes;
    this.upstream = upstream;
    this.caller = caller;
    this.mapper = mapper;
  }

  @PostMapping("/api/apps/{appId}/functions/challengeEngine")
  public ResponseEntity<?> handle(@RequestBody(required = false) Map<String, Object> body) {
    Map<String, Object> request = body == null ? Map.of() : body;
    String action = str(request.get("action"));
    String sessionToken = str(request.get("session_token"));

    try {
      String email = caller.email(sessionToken);
      if (email == null && !PUBLIC_ACTIONS.contains(action)) {
        return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
      }
      boolean isAdmin = caller.isAdmin(sessionToken);

      switch (action) {
        case "list": {
          List<JsonNode> list = upstream.challenges(
              Map.of("limit", "200", "include_inactive", "true"));
          return ResponseEntity.ok(Map.of("challenges", list));
        }
        case "get": {
          String id = str(request.get("id"));
          if (id.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "id required"));
          }
          List<JsonNode> list = upstream.challenges(Map.of("id", id, "include_inactive", "true"));
          JsonNode match = list.stream()
              .filter(c -> id.equals(c.path("id").asText("")))
              .findFirst()
              .orElse(list.isEmpty() ? null : list.get(0));
          Map<String, Object> out = new LinkedHashMap<>();
          out.put("challenge", match);
          return ResponseEntity.ok(out);
        }
        case "entries":
          return entries(str(request.get("challenge_id")), isAdmin);
        case "create":
          return isAdmin ? create(request) : adminOnly();
        case "moderate_entry":
          return isAdmin ? moderateOne(request) : adminOnly();
        case "moderate_entries":
          return isAdmin ? moderateMany(request) : adminOnly();
        default:
          return ResponseEntity.badRequest().body(Map.of("error", "Unknown action"));
      }
    } catch (Exception e) {
      log.error("challengeEngine action '{}' failed", action, e);
      return ApiErrors.internal(e);
    }
  }

  private static ResponseEntity<?> adminOnly() {
    return ResponseEntity.status(403).body(Map.of("error", "Admin only"));
  }

  private ResponseEntity<?> entries(String challengeId, boolean isAdmin) {
    if (challengeId.isEmpty()) {
      return ResponseEntity.badRequest().body(Map.of("error", "challenge_id required"));
    }

    List<EntryEntity> rows = isAdmin
        ? entries.findByChallengeIdOrderByCreatedDateDesc(challengeId)
        : entries.findApprovedByChallengeId(challengeId);

    // Live per-entry counts from the vote table, so cards, banner and detail
    // page all show the same number without a second round trip.
    Map<String, Long> counts = new LinkedHashMap<>();
    for (Object[] row : votes.countsByEntry(challengeId)) {
      counts.put((String) row[0], (Long) row[1]);
    }

    List<Map<String, Object>> out = new ArrayList<>();
    for (EntryEntity e : rows) {
      if (!isAdmin && !publiclyListable(e)) {
        continue;
      }
      Map<String, Object> safe = mapper.convertValue(e, new com.fasterxml.jackson.core.type.TypeReference<>() {});
      // Entrant email addresses are never sent to a client.
      safe.remove("creator_email");
      Long live = counts.get(e.getId());
      safe.put("vote_count", live != null ? live : (e.getVoteCount() == null ? 0 : e.getVoteCount()));
      out.add(safe);
    }
    return ResponseEntity.ok(Map.of("entries", out));
  }

  /** Children and teens stay hidden until a guardian has approved. */
  private static boolean publiclyListable(EntryEntity e) {
    if (isChild(e) && !"approved".equals(nz(e.getGuardianApprovalStatus()))) {
      return false;
    }
    return true;
  }

  private static boolean isChild(EntryEntity e) {
    return Boolean.TRUE.equals(e.getIsMinor())
        || CHILD_DIVISIONS.contains(nz(e.getDivision()).toLowerCase());
  }

  private ResponseEntity<?> create(Map<String, Object> request) {
    Object rawData = request.get("data");
    Map<String, Object> d = rawData instanceof Map<?, ?> map
        ? mapper.convertValue(map, new com.fasterxml.jackson.core.type.TypeReference<>() {})
        : Map.of();

    Map<String, Object> payload = new LinkedHashMap<>();
    String theme = firstNonBlank(str(d.get("theme")), str(d.get("title")));
    payload.put("theme", theme);
    payload.put("title", firstNonBlank(str(d.get("title")), str(d.get("theme"))));
    payload.put("description", firstNonBlank(str(d.get("brief")), str(d.get("description"))));
    payload.put("start_date", day(d.get("starts_at")));
    payload.put("end_date", day(d.get("submission_ends_at")));
    putIfPresent(payload, "voting_end_date", day(d.get("voting_ends_at")));
    putIfPresent(payload, "category", str(d.get("category")));
    putIfPresent(payload, "state", str(d.get("state")));
    putIfPresent(payload, "season", str(d.get("season")));
    payload.put("stage", firstNonBlank(str(d.get("stage")), "state"));
    String status = str(d.get("status"));
    payload.put("status", CHALLENGE_STATUSES.contains(status) ? status : "draft");
    putIfPresent(payload, "cover_image", str(d.get("cover_image")));
    if (d.get("divisions") instanceof List<?> divs && !divs.isEmpty()) {
      payload.put("age_divisions", divs);
    }
    payload.put("content_type",
        "host_managed".equals(str(d.get("content_type"))) ? "host_managed" : "admin_managed");

    if (blank(payload.get("theme")) || blank(payload.get("description"))
        || blank(payload.get("start_date")) || blank(payload.get("end_date"))) {
      return ResponseEntity.badRequest().body(Map.of(
          "error", "Title, brief, start date and submissions close date are required."));
    }

    JsonNode res = upstream.post("create_challenge", payload);
    if (!res.path("success").asBoolean(false) || res.path("id").asText("").isEmpty()) {
      // Upstream's own message, not a generic one — it is the only thing that
      // says WHY the challenge was rejected.
      String message = firstNonBlank(
          res.path("error").asText(""),
          res.path("message").asText(""),
          "The main app rejected this challenge.");
      return ResponseEntity.badRequest().body(Map.of("error", message));
    }

    Object challenge = res.path("challenge").isObject() ? res.path("challenge") : withId(payload, res.path("id").asText(""));
    return ResponseEntity.ok(Map.of("challenge", challenge));
  }

  private ResponseEntity<?> moderateOne(Map<String, Object> request) {
    String entryId = str(request.get("entry_id"));
    String status = str(request.get("status"));
    if (entryId.isEmpty() || !MODERATION_STATUSES.contains(status)) {
      return ResponseEntity.badRequest()
          .body(Map.of("error", "entry_id and a valid status are required"));
    }

    EntryEntity entry = entries.findById(entryId).orElse(null);
    if (entry == null) {
      return ResponseEntity.status(404).body(Map.of("error", "Entry no longer exists"));
    }
    String guard = guardianBlock(entry, status);
    if (guard != null) {
      return ResponseEntity.status(403).body(Map.of("error", guard));
    }

    apply(entry, status, Instant.now(), "single-" + System.currentTimeMillis());
    entries.save(entry);

    Map<String, Object> safe = mapper.convertValue(entry, new com.fasterxml.jackson.core.type.TypeReference<>() {});
    safe.remove("creator_email");
    return ResponseEntity.ok(Map.of("ok", true, "entry", safe));
  }

  /**
   * Deliberately NOT transactional. Each entry is saved on its own and the
   * per-entry outcome is reported back, so one failure does not discard the
   * moderation work already done — which is what the original did, and what the
   * admin UI expects when it renders the results list. Wrapping the loop in a
   * transaction would turn a partial success into a total rollback and make the
   * per-entry "ok" flags a lie.
   *
   * <p>(A @Transactional here would in any case have done nothing: this is
   * called from handle() in the same class, and self-invocation never passes
   * through the Spring proxy that applies it.)
   */
  private ResponseEntity<?> moderateMany(Map<String, Object> request) {
    List<?> raw = request.get("entry_ids") instanceof List<?> l ? l : List.of();
    List<String> ids = raw.stream().map(ChallengeEngineController::str)
        .filter(s -> !s.isEmpty()).toList();
    String status = str(request.get("status"));
    if (ids.isEmpty() || !MODERATION_STATUSES.contains(status)) {
      return ResponseEntity.badRequest()
          .body(Map.of("error", "entry_ids and a valid status are required"));
    }

    String batchId = "batch-" + System.currentTimeMillis();
    Instant moderatedAt = Instant.now();
    List<Map<String, Object>> results = new ArrayList<>();

    for (String entryId : ids) {
      EntryEntity entry = entries.findById(entryId).orElse(null);
      if (entry == null) {
        results.add(Map.of("entry_id", entryId, "ok", false, "error", "Entry no longer exists"));
        continue;
      }
      if (status.equals(nz(entry.getStatus()))) {
        results.add(Map.of("entry_id", entryId, "ok", false, "skipped", true,
            "error", "Already " + status));
        continue;
      }
      String guard = guardianBlock(entry, status);
      if (guard != null) {
        results.add(Map.of("entry_id", entryId, "ok", false, "error", guard));
        continue;
      }
      apply(entry, status, moderatedAt, batchId);
      entries.save(entry);
      results.add(Map.of("entry_id", entryId, "ok", true, "status", status));
    }

    long succeeded = results.stream().filter(r -> Boolean.TRUE.equals(r.get("ok"))).count();
    return ResponseEntity.ok(Map.of(
        "ok", true,
        "results", results,
        "succeeded", succeeded,
        "failed", results.size() - succeeded));
  }

  /**
   * The reason this entry may not be approved, or null when it may.
   *
   * <p>A child's entry cannot be published before a guardian has approved it.
   * This is the one rule here with a consequence beyond the product, so it is
   * checked on both the single and batch paths rather than trusted to the
   * caller.
   */
  private static String guardianBlock(EntryEntity entry, String status) {
    if (!"approved".equals(status)) {
      return null;
    }
    if (isChild(entry) && !"approved".equals(nz(entry.getGuardianApprovalStatus()))) {
      return "Cannot approve a children/teens or minor entry until "
          + "guardian_approval_status is approved.";
    }
    return null;
  }

  private static void apply(EntryEntity entry, String status, Instant at, String batchId) {
    entry.setStatus(status);
    entry.setModeratedAt(at);
    entry.setModerationBatchId(batchId);
  }

  private static Map<String, Object> withId(Map<String, Object> payload, String id) {
    Map<String, Object> out = new LinkedHashMap<>(payload);
    out.put("id", id);
    return out;
  }

  private static void putIfPresent(Map<String, Object> map, String key, String value) {
    if (value != null && !value.isEmpty()) {
      map.put(key, value);
    }
  }

  /** ISO timestamp to a plain date, matching the upstream payload format. */
  private static String day(Object v) {
    String s = str(v);
    return s.length() >= 10 ? s.substring(0, 10) : "";
  }

  private static String firstNonBlank(String... values) {
    for (String v : values) {
      if (v != null && !v.isBlank()) {
        return v;
      }
    }
    return "";
  }

  private static boolean blank(Object v) {
    return v == null || String.valueOf(v).isBlank();
  }

  private static String nz(String v) {
    return v == null ? "" : v;
  }

  private static String str(Object v) {
    return v == null ? "" : String.valueOf(v);
  }
}
