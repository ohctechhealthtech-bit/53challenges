package com.fiftythree.challenges.feed;

import com.fasterxml.jackson.databind.JsonNode;
import com.fiftythree.challenges.engine.EntryQueryRepository;
import com.fiftythree.challenges.entity.EntryEntity;
import com.fiftythree.challenges.upstream.ChallengeApiClient;
import com.fiftythree.challenges.vote.VoteRepository;
import com.fiftythree.challenges.support.ApiErrors;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Limit;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/**
 * The Java replacement for {@code latestEntries}: the homepage feed of recent
 * approved entries, plus admin-marked finalists.
 *
 * <p>Challenges and entries come from the upstream API; vote counts come from
 * this database, because the local vote table is the live source the challenge
 * pages also use.
 */
@RestController
public class LatestEntriesController {

  private static final Logger log = LoggerFactory.getLogger(LatestEntriesController.class);

  private static final int DEFAULT_LIMIT = 24;
  private static final int MAX_LIMIT = 100;
  private static final int MAX_FINALISTS = 5;
  private static final int ENTRIES_PER_CHALLENGE = 100;

  /**
   * Seeded, QA and demo content that must never reach the public homepage.
   *
   * <p>These are content filters, not security: the underlying records are
   * ordinary approved entries and would otherwise be shown. Copied verbatim
   * from the original, including the specific titles — removing one would put
   * that test data straight onto the front page.
   */
  private static final List<Pattern> BAD_PATTERNS = List.of(
      Pattern.compile("\\bqa\\b", Pattern.CASE_INSENSITIVE),
      Pattern.compile("\\btest\\b", Pattern.CASE_INSENSITIVE),
      Pattern.compile("\\bseed", Pattern.CASE_INSENSITIVE),
      Pattern.compile("\\bdemo\\b", Pattern.CASE_INSENSITIVE),
      Pattern.compile("\\bmock\\b", Pattern.CASE_INSENSITIVE),
      Pattern.compile("\\bplaceholder\\b", Pattern.CASE_INSENSITIVE),
      Pattern.compile("\\bsample\\b", Pattern.CASE_INSENSITIVE),
      Pattern.compile("dannce", Pattern.CASE_INSENSITIVE),
      Pattern.compile("cod kill master", Pattern.CASE_INSENSITIVE),
      Pattern.compile("warzone", Pattern.CASE_INSENSITIVE),
      Pattern.compile("biggest loser", Pattern.CASE_INSENSITIVE),
      Pattern.compile("endless ideas", Pattern.CASE_INSENSITIVE));

  /** "Creator 1", "Creator 2" — seeded finalist names from upstream. */
  private static final Pattern CREATOR_N = Pattern.compile("\\bcreator\\s*\\d", Pattern.CASE_INSENSITIVE);
  /** "Entry 1", "Entry 2" — seeded entry titles. */
  private static final Pattern ENTRY_N = Pattern.compile("entry\\s*\\d", Pattern.CASE_INSENSITIVE);

  private static final Set<String> CHILD_DIVISIONS = Set.of("children", "teens");

  private final ChallengeApiClient upstream;
  private final VoteRepository votes;
  private final EntryQueryRepository entries;

  public LatestEntriesController(
      ChallengeApiClient upstream, VoteRepository votes, EntryQueryRepository entries) {
    this.upstream = upstream;
    this.votes = votes;
    this.entries = entries;
  }

  @PostMapping("/api/apps/{appId}/functions/latestEntries")
  public ResponseEntity<?> handle(@RequestBody(required = false) Map<String, Object> body) {
    Map<String, Object> request = body == null ? Map.of() : body;
    int limit = Math.min(parseLimit(request.get("limit")), MAX_LIMIT);

    try {
      // Seeded challenges are dropped before their entries are fetched, which
      // also avoids an upstream round trip per junk challenge.
      List<JsonNode> challenges = upstream.challenges(Map.of()).stream()
          .filter(c -> !isBadChallenge(c))
          .toList();

      List<Map<String, Object>> all = new ArrayList<>();
      for (JsonNode ch : challenges) {
        String challengeId = ch.path("id").asText("");
        String challengeTitle = firstNonBlank(ch.path("title").asText(""), ch.path("theme").asText(""));
        String votingEnds = firstNonBlank(
            ch.path("voting_end_date").asText(""), ch.path("voting_ends_at").asText(""));
        String category = ch.path("category").asText("");

        for (JsonNode e : upstream.entries(challengeId, ENTRIES_PER_CHALLENGE)) {
          if (!"approved".equals(e.path("status").asText(""))) {
            continue;
          }
          if (isBadText(e.path("title").asText(""), e.path("creator_name").asText(""), challengeTitle)) {
            continue;
          }
          if (isUnapprovedChild(e)) {
            continue;
          }
          Map<String, Object> row = toMap(e);
          row.put("challenge_id", challengeId);
          row.put("challenge_title", challengeTitle);
          row.put("challenge_voting_ends_at", votingEnds);
          row.put("challenge_category", category);
          all.add(row);
        }
      }

      // Newest first. submitted_at is ISO-8601 and lexicographic order on that
      // format is chronological order, so no parsing — and no timezone
      // misreading of the values that arrive without a Z.
      all.sort(Comparator.comparing(
          (Map<String, Object> r) -> firstNonBlank(str(r.get("submitted_at")), str(r.get("created_date"))))
          .reversed());

      List<Map<String, Object>> recent = all.size() > limit ? all.subList(0, limit) : all;

      List<EntryEntity> finalistRows = entries.findFinalists(Limit.of(MAX_FINALISTS));

      // One query for every id the response needs — the recent entries and the
      // finalists together. The original looked up finalist counts only when
      // there were no recent entries, so on a populated homepage a finalist's
      // live count was silently skipped in favour of its stored vote_count.
      LinkedHashSet<String> wanted = new LinkedHashSet<>();
      recent.forEach(r -> wanted.add(str(r.get("id"))));
      finalistRows.forEach(f -> {
        if (f.getUpstreamEntryId() != null && !f.getUpstreamEntryId().isBlank()) {
          wanted.add(f.getUpstreamEntryId());
        }
      });

      Map<String, Long> voteCounts = new LinkedHashMap<>();
      if (!wanted.isEmpty()) {
        for (Object[] row : votes.countsByEntryIds(wanted)) {
          voteCounts.put((String) row[0], (Long) row[1]);
        }
      }

      for (Map<String, Object> r : recent) {
        Long live = voteCounts.get(str(r.get("id")));
        if (live != null) {
          r.put("community_votes", live);
        } else if (r.get("community_votes") == null) {
          r.put("community_votes", r.get("vote_count") == null ? 0 : r.get("vote_count"));
        }
      }

      List<Map<String, Object>> finalists = new ArrayList<>();
      for (EntryEntity f : finalistRows) {
        String id = f.getUpstreamEntryId() == null || f.getUpstreamEntryId().isBlank()
            ? f.getId()
            : f.getUpstreamEntryId();
        Long live = voteCounts.get(f.getUpstreamEntryId());
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("id", id);
        out.put("challenge_id", f.getChallengeId());
        out.put("challenge_title", nz(f.getChallengeTitle()));
        out.put("title", f.getTitle());
        out.put("creator_name", f.getCreatorName());
        out.put("state", f.getState());
        out.put("category", nz(f.getCategory()));
        out.put("work_url", nz(f.getWorkLink()));
        out.put("community_votes", live != null ? live : (f.getVoteCount() == null ? 0 : f.getVoteCount()));
        out.put("is_finalist", true);
        finalists.add(out);
      }

      return ResponseEntity.ok(Map.of(
          "entries", recent,
          "finalists", finalists,
          "count", recent.size()));
    } catch (Exception e) {
      log.error("latestEntries failed", e);
      return ApiErrors.internal(e);
    }
  }

  private static boolean isBadChallenge(JsonNode ch) {
    if (ch == null || ch.isMissingNode()) {
      return true;
    }
    String title = ch.path("title").asText("");
    String theme = ch.path("theme").asText("");
    // Seeded demo challenges have no title or theme at all.
    if (title.isBlank() && theme.isBlank()) {
      return true;
    }
    return isBadText(title, theme, ch.path("description").asText(""));
  }

  private static boolean isBadText(String... parts) {
    StringBuilder sb = new StringBuilder();
    for (String p : parts) {
      if (p != null && !p.isEmpty()) {
        sb.append(p).append(' ');
      }
    }
    String text = sb.toString();
    if (text.isBlank()) {
      return true;
    }
    for (Pattern p : BAD_PATTERNS) {
      if (p.matcher(text).find()) {
        return true;
      }
    }
    return CREATOR_N.matcher(text).find() || ENTRY_N.matcher(text).find();
  }

  /** A child's entry stays off the homepage until a guardian has approved it. */
  private static boolean isUnapprovedChild(JsonNode e) {
    boolean minor = e.path("is_minor").asBoolean(false)
        || CHILD_DIVISIONS.contains(
            firstNonBlank(e.path("division").asText(""), e.path("division_name").asText(""))
                .toLowerCase());
    return minor && !"approved".equals(e.path("guardian_approval_status").asText(""));
  }

  private static Map<String, Object> toMap(JsonNode node) {
    Map<String, Object> out = new LinkedHashMap<>();
    node.fields().forEachRemaining(f -> {
      JsonNode v = f.getValue();
      if (v.isNull()) {
        out.put(f.getKey(), null);
      } else if (v.isNumber()) {
        out.put(f.getKey(), v.numberValue());
      } else if (v.isBoolean()) {
        out.put(f.getKey(), v.booleanValue());
      } else if (v.isTextual()) {
        out.put(f.getKey(), v.textValue());
      } else {
        out.put(f.getKey(), v);
      }
    });
    return out;
  }

  private static int parseLimit(Object raw) {
    try {
      int n = Integer.parseInt(str(raw).trim());
      return n > 0 ? n : DEFAULT_LIMIT;
    } catch (Exception e) {
      return DEFAULT_LIMIT;
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

  private static String nz(String v) {
    return v == null ? "" : v;
  }

  private static String str(Object v) {
    return v == null ? "" : String.valueOf(v);
  }
}
