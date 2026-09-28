package com.fiftythree.challenges.feed;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fiftythree.challenges.engine.EntryQueryRepository;
import com.fiftythree.challenges.entity.ChallengeEntity;
import com.fiftythree.challenges.entity.ChallengeRepository;
import com.fiftythree.challenges.entity.EntryEntity;
import com.fiftythree.challenges.security.CallerResolver;
import com.fiftythree.challenges.upstream.ChallengeApiClient;
import com.fiftythree.challenges.vote.VoteEntity;
import com.fiftythree.challenges.vote.VoteRepository;
import com.fiftythree.challenges.support.ApiErrors;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
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
 * A signed-in person's own entries and votes: {@code myEntries} and
 * {@code myVotes}.
 *
 * <p><b>Identity always comes from the verified session, never the request
 * body.</b> Both endpoints return one person's private history, and an
 * email accepted from the caller would let anyone read anyone else's.
 */
@RestController
public class MyStuffController {

  private static final Logger log = LoggerFactory.getLogger(MyStuffController.class);

  private final EntryQueryRepository entries;
  private final VoteRepository votes;
  private final ChallengeRepository challenges;
  private final ChallengeApiClient upstream;
  private final CallerResolver caller;
  private final ObjectMapper mapper;

  public MyStuffController(
      EntryQueryRepository entries,
      VoteRepository votes,
      ChallengeRepository challenges,
      ChallengeApiClient upstream,
      CallerResolver caller,
      ObjectMapper mapper) {
    this.entries = entries;
    this.votes = votes;
    this.challenges = challenges;
    this.upstream = upstream;
    this.caller = caller;
    this.mapper = mapper;
  }

  // ------------------------------------------------------------------ myEntries

  @PostMapping("/api/apps/{appId}/functions/myEntries")
  public ResponseEntity<?> myEntries(@RequestBody(required = false) Map<String, Object> body) {
    Map<String, Object> request = body == null ? Map.of() : body;
    String email = caller.email(str(request.get("session_token")));
    if (email == null) {
      return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
    }

    try {
      List<Map<String, Object>> out = new ArrayList<>();

      // Challenges are looked up once each, not once per entry: several entries
      // usually belong to the same challenge.
      Map<String, ChallengeEntity> seen = new HashMap<>();
      for (EntryEntity e : entries.findByCreatorEmail(email)) {
        Map<String, Object> row = toMap(e);
        row.remove("creator_email");

        String challengeId = nz(e.getChallengeId());
        ChallengeEntity ch = challengeId.isEmpty()
            ? null
            : seen.computeIfAbsent(challengeId, id -> challenges.findById(id).orElse(null));

        // Editability is decided here and sent to the UI, so the label can
        // never disagree with what an update would actually allow.
        boolean editable = true;
        String lockedReason = "";
        if ("approved".equals(nz(e.getStatus()))) {
          editable = false;
          lockedReason = "Approved — locked. This entry can no longer be edited.";
        } else if (challengeClosed(ch)) {
          editable = false;
          lockedReason = "This challenge has closed — entries can no longer be edited.";
        }
        row.put("editable", editable);
        row.put("locked_reason", lockedReason);
        out.add(row);
      }

      // Entries submitted on the main site stay editable until a reviewer has
      // decided on them; the update is pushed back to that site.
      JsonNode upstreamBody = upstream.postTo(
          upstream.sibling("publicChallengeApi"),
          Map.of("action", "my_entries", "email", email)).body();
      for (JsonNode e : upstreamBody.path("entries")) {
        Map<String, Object> row = toMap(e);
        String status = e.path("status").asText("pending");
        boolean pending = "pending".equals(status) || "rejected".equals(status);
        row.put("main_site", true);
        row.put("editable", pending);
        row.put("locked_reason", pending
            ? ""
            : firstNonBlank(e.path("locked_reason").asText(""),
                "This entry has been reviewed — it can no longer be edited."));
        out.add(row);
      }

      return ResponseEntity.ok(Map.of("entries", out, "count", out.size()));
    } catch (Exception e) {
      log.error("myEntries failed", e);
      return ApiErrors.internal(e);
    }
  }

  /**
   * Whether a challenge has stopped accepting entries — either its submission
   * deadline has passed, or a native challenge has moved out of entry_open.
   */
  private static boolean challengeClosed(ChallengeEntity ch) {
    if (ch == null) {
      return false;
    }
    Instant end = ch.getSubmissionEndsAt();
    if (end != null && !end.isAfter(Instant.now())) {
      return true;
    }
    return "native".equals(nz(ch.getSource())) && !"entry_open".equals(nz(ch.getLifecycleStatus()));
  }

  // -------------------------------------------------------------------- myVotes

  @PostMapping("/api/apps/{appId}/functions/myVotes")
  public ResponseEntity<?> myVotes(@RequestBody(required = false) Map<String, Object> body) {
    Map<String, Object> request = body == null ? Map.of() : body;
    // The original accepted only a Base44 platform session here, unlike
    // myEntries beside it, so entrants who signed in through the Challenge-API
    // login could never see their own votes. Both use the same resolver now.
    String email = caller.email(str(request.get("session_token")));
    if (email == null) {
      return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
    }

    try {
      List<VoteEntity> cast = votes.findByUserEmail(email);
      if (cast.isEmpty()) {
        return ResponseEntity.ok(Map.of("entries", List.of(), "count", 0));
      }

      Map<String, Instant> votedAt = new LinkedHashMap<>();
      Map<String, Set<String>> byChallenge = new LinkedHashMap<>();
      LinkedHashSet<String> allEntryIds = new LinkedHashSet<>();
      for (VoteEntity v : cast) {
        if (v.getEntryId() == null) {
          continue;
        }
        allEntryIds.add(v.getEntryId());
        votedAt.putIfAbsent(v.getEntryId(), v.getCreatedDate());
        byChallenge
            .computeIfAbsent(nz(v.getChallengeId()), k -> new LinkedHashSet<>())
            .add(v.getEntryId());
      }

      // Entries held in this app resolve locally; the rest come from upstream.
      List<Map<String, Object>> out = new ArrayList<>();
      Set<String> resolvedLocally = new HashSet<>();
      for (EntryEntity e : entries.findByIdIn(allEntryIds)) {
        Map<String, Object> row = toMap(e);
        row.remove("creator_email");
        row.put("voted_at", votedAt.get(e.getId()));
        out.add(row);
        resolvedLocally.add(e.getId());
      }

      Map<String, JsonNode> challengeById = new HashMap<>();
      for (JsonNode ch : upstream.challenges(Map.of())) {
        challengeById.put(ch.path("id").asText(""), ch);
      }

      for (Map.Entry<String, Set<String>> group : byChallenge.entrySet()) {
        String challengeId = group.getKey();
        if (challengeId.isEmpty()) {
          continue;
        }
        JsonNode ch = challengeById.get(challengeId);
        String title = ch == null
            ? ""
            : firstNonBlank(ch.path("title").asText(""), ch.path("theme").asText(""));

        for (JsonNode e : upstream.entries(challengeId, 100)) {
          String id = e.path("id").asText("");
          if (!group.getValue().contains(id) || resolvedLocally.contains(id)) {
            continue;
          }
          Map<String, Object> row = toMap(e);
          row.put("challenge_title", title);
          row.put("challenge_id", challengeId);
          row.put("voted_at", votedAt.get(id));
          out.add(row);
        }
      }

      return ResponseEntity.ok(Map.of("entries", out, "count", out.size()));
    } catch (Exception e) {
      log.error("myVotes failed", e);
      return ApiErrors.internal(e);
    }
  }

  // ------------------------------------------------------------------ plumbing

  private Map<String, Object> toMap(Object o) {
    return mapper.convertValue(o, new com.fasterxml.jackson.core.type.TypeReference<>() {});
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
