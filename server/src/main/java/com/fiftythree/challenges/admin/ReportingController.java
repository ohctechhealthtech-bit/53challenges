package com.fiftythree.challenges.admin;

import com.fasterxml.jackson.databind.JsonNode;
import com.fiftythree.challenges.entity.AudienceMemberEntity;
import com.fiftythree.challenges.entity.AudienceMemberRepository;
import com.fiftythree.challenges.entity.EmailCampaignEntity;
import com.fiftythree.challenges.entity.EmailCampaignRepository;
import com.fiftythree.challenges.entity.EntryJudgeAssignmentEntity;
import com.fiftythree.challenges.entity.PartnerInquiryEntity;
import com.fiftythree.challenges.entity.ScoreEntity;
import com.fiftythree.challenges.judging.AssignmentQueryRepository;
import com.fiftythree.challenges.judging.ScoreQueryRepository;
import com.fiftythree.challenges.security.CallerResolver;
import com.fiftythree.challenges.support.JsonColumn;
import com.fiftythree.challenges.upstream.ChallengeApiClient;
import com.fiftythree.challenges.user.UserRepository;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
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
 * The Java replacement for {@code reporting}: the admin analytics view, either
 * platform-wide or scoped to one challenge.
 */
@RestController
public class ReportingController {

  private static final Logger log = LoggerFactory.getLogger(ReportingController.class);

  /** Platform-wide entry counts are capped to the most recent challenges. */
  private static final int CHALLENGE_SCOPE = 12;
  private static final int ENTRIES_PER_CHALLENGE = 500;

  private final ScoreQueryRepository scores;
  private final AssignmentQueryRepository assignments;
  private final AudienceMemberRepository audience;
  private final EmailCampaignRepository campaigns;
  private final InquiryRepo inquiries;
  private final UserRepository users;
  private final ChallengeApiClient upstream;
  private final CallerResolver caller;
  private final JsonColumn json;

  public ReportingController(
      ScoreQueryRepository scores,
      AssignmentQueryRepository assignments,
      AudienceMemberRepository audience,
      EmailCampaignRepository campaigns,
      InquiryRepo inquiries,
      UserRepository users,
      ChallengeApiClient upstream,
      CallerResolver caller,
      JsonColumn json) {
    this.scores = scores;
    this.assignments = assignments;
    this.audience = audience;
    this.campaigns = campaigns;
    this.inquiries = inquiries;
    this.users = users;
    this.upstream = upstream;
    this.caller = caller;
    this.json = json;
  }

  @PostMapping("/api/apps/{appId}/functions/reporting")
  public ResponseEntity<?> handle(@RequestBody(required = false) Map<String, Object> body) {
    Map<String, Object> request = body == null ? Map.of() : body;
    String sessionToken = str(request.get("session_token"));
    if (caller.email(sessionToken) == null) {
      return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
    }
    if (!caller.isAdmin(sessionToken)) {
      return ResponseEntity.status(403).body(Map.of("error", "Forbidden"));
    }

    try {
      List<ScoreEntity> allScores = scores.findAll();
      List<EntryJudgeAssignmentEntity> allAssignments = assignments.findAll();

      String challengeId = str(request.get("challenge_id"));
      return challengeId.isEmpty()
          ? platformWide(allScores, allAssignments)
          : scoped(challengeId, allScores, allAssignments);
    } catch (Exception e) {
      log.error("reporting failed", e);
      return ResponseEntity.status(500).body(Map.of("error", e.getMessage()));
    }
  }

  private ResponseEntity<?> scoped(
      String challengeId, List<ScoreEntity> allScores,
      List<EntryJudgeAssignmentEntity> allAssignments) {

    JsonNode challenge = upstream.challenges(Map.of("id", challengeId)).stream()
        .findFirst().orElse(null);
    List<JsonNode> entries = upstream.entries(challengeId, ENTRIES_PER_CHALLENGE);

    Set<String> entryIds = new LinkedHashSet<>();
    Set<String> creators = new LinkedHashSet<>();
    long totalVotes = 0;
    for (JsonNode e : entries) {
      entryIds.add(e.path("id").asText(""));
      String creatorEmail = e.path("creator_email").asText("");
      if (!creatorEmail.isEmpty()) {
        creators.add(creatorEmail.toLowerCase());
      }
      totalVotes += votesOf(e);
    }

    String title = firstNonBlank(
        challenge == null ? "" : challenge.path("theme").asText(""),
        challenge == null ? "" : challenge.path("title").asText(""),
        "Selected challenge");

    JudgeStats judgeStats = judgeStats(allScores, allAssignments, entryIds);

    List<Map<String, Object>> entryRows = new ArrayList<>();
    for (JsonNode e : entries) {
      Map<String, Object> row = new LinkedHashMap<>();
      row.put("id", e.path("id").asText(""));
      row.put("title", firstNonBlank(
          e.path("title").asText(""), e.path("work_title").asText(""), "Untitled"));
      row.put("creator_name", e.path("creator_name").asText(""));
      row.put("state", e.path("state").asText(""));
      row.put("category", e.path("category").asText(""));
      row.put("division", e.path("division").asText(""));
      row.put("status", firstNonBlank(e.path("status").asText(""), "pending"));
      row.put("vote_count", votesOf(e));
      row.put("submitted_at", e.path("submitted_at").asText(""));
      // Deliberately field by field: the upstream entry carries creator_email,
      // which has no place in a report rendered in a browser.
      entryRows.add(row);
    }

    Map<String, Object> out = new LinkedHashMap<>();
    out.put("scoped", true);
    out.put("challenge", Map.of("id", challengeId, "title", title));
    out.put("summary", Map.of(
        "competitions", 1,
        "totalEntries", entries.size(),
        "users", 0,
        "creators", creators.size(),
        "conversionRate", 0));
    out.put("entriesByCompetition", List.of(Map.of(
        "id", challengeId, "title", title,
        "count", entries.size(), "votes", totalVotes)));
    out.put("entriesByState", countBy(entries, e -> firstNonBlank(
        e.path("state").asText(""), "Unknown"), "state"));
    out.put("moderation", moderation(entries, false));
    out.put("judges", judgeStats.rows());
    out.put("consistency", judgeStats.consistency());
    out.put("totalVotes", totalVotes);
    out.put("entries", entryRows);
    return ResponseEntity.ok(out);
  }

  private ResponseEntity<?> platformWide(
      List<ScoreEntity> allScores, List<EntryJudgeAssignmentEntity> allAssignments) {

    List<JsonNode> challenges = upstream.challenges(Map.of());
    // Capped: one upstream call per challenge, so the whole catalogue would
    // make this report slower than anyone will wait for.
    List<JsonNode> recent = challenges.size() > CHALLENGE_SCOPE
        ? challenges.subList(0, CHALLENGE_SCOPE) : challenges;

    List<JsonNode> allEntries = new ArrayList<>();
    List<Map<String, Object>> byCompetition = new ArrayList<>();
    for (JsonNode c : recent) {
      String id = c.path("id").asText("");
      List<JsonNode> entries = upstream.entries(id, ENTRIES_PER_CHALLENGE);
      allEntries.addAll(entries);

      long votes = c.path("total_votes").isNumber()
          ? c.path("total_votes").asLong()
          : entries.stream().mapToLong(ReportingController::votesOf).sum();
      Map<String, Object> row = new LinkedHashMap<>();
      row.put("id", id);
      row.put("title", firstNonBlank(
          c.path("theme").asText(""), c.path("title").asText(""), "Untitled"));
      row.put("count", c.path("total_entries").isNumber()
          ? c.path("total_entries").asInt() : entries.size());
      row.put("votes", votes);
      byCompetition.add(row);
    }
    byCompetition.sort(Comparator.comparingInt(
        (Map<String, Object> r) -> (int) r.get("count")).reversed());

    Set<String> creators = new LinkedHashSet<>();
    for (JsonNode e : allEntries) {
      String creatorEmail = e.path("creator_email").asText("");
      if (!creatorEmail.isEmpty()) {
        creators.add(creatorEmail.toLowerCase());
      }
    }
    long totalUsers = users.count();
    double conversionRate = totalUsers == 0
        ? 0 : Math.round((creators.size() / (double) totalUsers) * 1000) / 10.0;

    JudgeStats judgeStats = judgeStats(allScores, allAssignments, null);

    Map<String, Object> out = new LinkedHashMap<>();
    out.put("summary", Map.of(
        "competitions", challenges.size(),
        "totalEntries", allEntries.size(),
        "users", totalUsers,
        "creators", creators.size(),
        "conversionRate", conversionRate));
    out.put("entriesByCompetition", byCompetition);
    out.put("entriesByState", countBy(allEntries, e -> firstNonBlank(
        e.path("state").asText(""), "Unknown"), "state"));
    out.put("moderation", moderation(allEntries, true));
    out.put("audience", audienceStats());
    out.put("campaigns", campaignRows());
    out.put("judges", judgeStats.rows());
    out.put("consistency", judgeStats.consistency());
    out.put("pipeline", pipeline());
    return ResponseEntity.ok(out);
  }

  /**
   * Per-judge throughput and turnaround, plus the panel's scoring consistency.
   *
   * @param entryIds when non-null, only scores on these entries are counted
   */
  private JudgeStats judgeStats(
      List<ScoreEntity> allScores,
      List<EntryJudgeAssignmentEntity> allAssignments,
      Set<String> entryIds) {

    Map<String, Instant> assignedAt = new HashMap<>();
    for (EntryJudgeAssignmentEntity a : allAssignments) {
      assignedAt.put(key(a.getPanelId(), a.getEntryId(), a.getJudgeProfileId()), a.getAssignedAt());
    }

    Map<String, long[]> counters = new LinkedHashMap<>();   // scored, turnaroundMs, turnCount
    Map<String, String> names = new LinkedHashMap<>();
    Map<String, List<Double>> perEntryTotals = new LinkedHashMap<>();

    for (ScoreEntity s : allScores) {
      if (entryIds != null && !entryIds.contains(nz(s.getEntryId()))) {
        continue;
      }
      String judgeId = nz(s.getJudgeProfileId());
      counters.computeIfAbsent(judgeId, k -> new long[3])[0]++;
      names.putIfAbsent(judgeId, firstNonBlank(s.getJudgeName(), judgeId));

      Instant assigned = assignedAt.get(key(s.getPanelId(), s.getEntryId(), judgeId));
      if (assigned != null && s.getSubmittedAt() != null) {
        long ms = Duration.between(assigned, s.getSubmittedAt()).toMillis();
        // A negative turnaround means the timestamps disagree; counting it
        // would drag the average below zero and hide a real delay.
        if (ms >= 0) {
          long[] c = counters.get(judgeId);
          c[1] += ms;
          c[2]++;
        }
      }

      double total = 0;
      for (JsonNode sc : json.nodes(s.getScores())) {
        total += sc.path("value").asDouble(0);
      }
      perEntryTotals.computeIfAbsent(nz(s.getEntryId()), k -> new ArrayList<>()).add(total);
    }

    List<Map<String, Object>> rows = new ArrayList<>();
    counters.forEach((judgeId, c) -> {
      Map<String, Object> row = new LinkedHashMap<>();
      row.put("judge", names.get(judgeId));
      row.put("scored", c[0]);
      row.put("avgTurnaroundHours", c[2] == 0
          ? null : Math.round((c[1] / (double) c[2]) / 3_600_000 * 10) / 10.0);
      rows.add(row);
    });
    rows.sort(Comparator.comparingLong(
        (Map<String, Object> r) -> (long) r.get("scored")).reversed());

    // Consistency is the mean standard deviation of judges' totals on the same
    // entry — how far apart they land when scoring identical work. Entries with
    // one score are skipped: a single opinion has no spread.
    double sum = 0;
    int count = 0;
    for (List<Double> totals : perEntryTotals.values()) {
      if (totals.size() < 2) {
        continue;
      }
      double mean = totals.stream().mapToDouble(Double::doubleValue).average().orElse(0);
      double variance = totals.stream()
          .mapToDouble(v -> Math.pow(v - mean, 2)).average().orElse(0);
      sum += Math.sqrt(variance);
      count++;
    }
    Double consistency = count == 0 ? null : Math.round((sum / count) * 100) / 100.0;

    return new JudgeStats(rows, consistency);
  }

  private Map<String, Object> moderation(List<JsonNode> entries, boolean withAge) {
    int pending = 0;
    int approved = 0;
    int rejected = 0;
    double ageSum = 0;
    int ageCount = 0;

    for (JsonNode e : entries) {
      String status = firstNonBlank(e.path("status").asText(""), "pending");
      switch (status) {
        case "approved" -> approved++;
        case "rejected" -> rejected++;
        default -> {
          pending++;
          String submitted = e.path("submitted_at").asText("");
          if (withAge && !submitted.isEmpty()) {
            try {
              double days = Duration.between(Instant.parse(submitted), Instant.now())
                  .toMillis() / 86_400_000.0;
              if (days >= 0) {
                ageSum += days;
                ageCount++;
              }
            } catch (Exception ignored) {
              // An unparseable timestamp is left out of the average rather
              // than counted as zero days waiting.
            }
          }
        }
      }
    }

    Map<String, Object> out = new LinkedHashMap<>();
    out.put("pending", pending);
    out.put("approved", approved);
    out.put("rejected", rejected);
    out.put("avgPendingAgeDays",
        ageCount == 0 ? 0 : Math.round((ageSum / ageCount) * 10) / 10.0);
    return out;
  }

  private Map<String, Object> audienceStats() {
    Map<String, Integer> byType = new LinkedHashMap<>();
    Map<String, Integer> byState = new LinkedHashMap<>();
    Map<String, Integer> bySource = new LinkedHashMap<>();
    Map<String, Integer> byCategory = new LinkedHashMap<>();
    int total = 0;
    int active = 0;

    for (AudienceMemberEntity m : audience.findAll()) {
      total++;
      if ("active".equals(nz(m.getStatus()))) {
        active++;
      }
      byType.merge(nz(m.getAudienceType()), 1, Integer::sum);
      if (!nz(m.getState()).isEmpty()) {
        byState.merge(m.getState(), 1, Integer::sum);
      }
      bySource.merge(nz(m.getSource()), 1, Integer::sum);
      for (String c : json.stringList(m.getCategoryInterests())) {
        byCategory.merge(c, 1, Integer::sum);
      }
    }

    Map<String, Object> out = new LinkedHashMap<>();
    out.put("total", total);
    out.put("active", active);
    out.put("unsubscribed", total - active);
    out.put("byType", labelled(byType));
    out.put("byState", labelled(byState));
    out.put("bySource", labelled(bySource));
    List<Map<String, Object>> categories = labelled(byCategory);
    out.put("byCategory", categories.size() > 8 ? categories.subList(0, 8) : categories);
    return out;
  }

  private List<Map<String, Object>> campaignRows() {
    List<Map<String, Object>> rows = new ArrayList<>();
    for (EmailCampaignEntity c : campaigns.findAll()) {
      Map<String, Object> row = new LinkedHashMap<>();
      row.put("id", c.getId());
      row.put("name", c.getName());
      row.put("type", c.getType());
      row.put("status", c.getStatus());
      row.put("sent", c.getSentCount() == null ? 0 : c.getSentCount());
      row.put("skipped", c.getSkippedUnregistered() == null ? 0 : c.getSkippedUnregistered());
      row.put("audience", c.getAudienceCount() == null ? 0 : c.getAudienceCount());
      rows.add(row);
    }
    return rows;
  }

  private List<Map<String, Object>> pipeline() {
    Map<String, Integer> counts = new LinkedHashMap<>();
    for (PartnerInquiryEntity i : inquiries.findAll()) {
      counts.merge(firstNonBlank(i.getPipelineStatus(), "new"), 1, Integer::sum);
    }
    // A fixed order with zeros included, so the funnel does not reshape itself
    // as stages empty.
    return List.of("new", "in_discussion", "confirmed", "live").stream()
        .map(s -> Map.<String, Object>of("status", s, "count", counts.getOrDefault(s, 0)))
        .toList();
  }

  private static List<Map<String, Object>> countBy(
      List<JsonNode> items, java.util.function.Function<JsonNode, String> key, String label) {
    Map<String, Integer> counts = new LinkedHashMap<>();
    for (JsonNode item : items) {
      counts.merge(key.apply(item), 1, Integer::sum);
    }
    List<Map<String, Object>> rows = new ArrayList<>();
    counts.forEach((k, v) -> rows.add(Map.of(label, k, "count", v)));
    rows.sort(Comparator.comparingInt((Map<String, Object> r) -> (int) r.get("count")).reversed());
    return rows;
  }

  private static List<Map<String, Object>> labelled(Map<String, Integer> counts) {
    List<Map<String, Object>> rows = new ArrayList<>();
    counts.forEach((k, v) -> rows.add(Map.of("label", k, "count", v)));
    rows.sort(Comparator.comparingInt((Map<String, Object> r) -> (int) r.get("count")).reversed());
    return rows;
  }

  private static long votesOf(JsonNode entry) {
    if (entry.path("community_votes").isNumber()) {
      return entry.path("community_votes").asLong();
    }
    return entry.path("vote_count").asLong(0);
  }

  private static String key(String panelId, String entryId, String judgeId) {
    return nz(panelId) + "|" + nz(entryId) + "|" + nz(judgeId);
  }

  private record JudgeStats(List<Map<String, Object>> rows, Double consistency) {}

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
