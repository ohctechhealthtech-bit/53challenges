package com.fiftythree.challenges.admin;

import com.fiftythree.challenges.engine.EntryQueryRepository;
import com.fiftythree.challenges.entity.CategoryEntity;
import com.fiftythree.challenges.entity.CategoryRepository;
import com.fiftythree.challenges.entity.ChallengeEntity;
import com.fiftythree.challenges.entity.ChallengeRepository;
import com.fiftythree.challenges.entity.EntryEntity;
import com.fiftythree.challenges.security.CallerResolver;
import com.fiftythree.challenges.support.ApiErrors;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
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
 * The Java replacement for {@code activityReport}: entry counts per challenge
 * and per category, plus today's moderation batches.
 */
@RestController
public class ActivityReportController {

  private static final Logger log = LoggerFactory.getLogger(ActivityReportController.class);

  private final ChallengeRepository challenges;
  private final EntryQueryRepository entries;
  private final CategoryRepository categories;
  private final CallerResolver caller;

  public ActivityReportController(
      ChallengeRepository challenges,
      EntryQueryRepository entries,
      CategoryRepository categories,
      CallerResolver caller) {
    this.challenges = challenges;
    this.entries = entries;
    this.categories = categories;
    this.caller = caller;
  }

  @PostMapping("/api/apps/{appId}/functions/activityReport")
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
      List<ChallengeEntity> allChallenges = challenges.findAll();
      List<EntryEntity> allEntries = entries.findAll();

      // Categories are keyed by both id and slug, because a challenge
      // references them either way depending on when it was created.
      Map<String, String> categoryName = new HashMap<>();
      for (CategoryEntity c : categories.findAll()) {
        categoryName.put(c.getId(), c.getName());
        if (c.getSlug() != null && !c.getSlug().isBlank()) {
          categoryName.put(c.getSlug(), c.getName());
        }
      }

      Map<String, int[]> perChallenge = new HashMap<>();
      for (EntryEntity e : allEntries) {
        // [total, pending, approved, rejected]
        int[] stats = perChallenge.computeIfAbsent(nz(e.getChallengeId()), k -> new int[4]);
        stats[0]++;
        stats[bucketOf(e.getStatus())]++;
      }

      List<Map<String, Object>> challengeRows = new ArrayList<>();
      for (ChallengeEntity c : allChallenges) {
        int[] stats = perChallenge.getOrDefault(c.getId(), new int[4]);
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("id", c.getId());
        row.put("title", firstNonBlank(c.getTitle(), c.getTheme(), "Untitled"));
        row.put("category", firstNonBlank(
            categoryName.get(nz(c.getCategoryId())),
            categoryName.get(nz(c.getCategory())),
            c.getCategory(),
            "Uncategorised"));
        row.put("lifecycle_status", firstNonBlank(c.getLifecycleStatus(), "draft"));
        row.put("total", stats[0]);
        row.put("pending", stats[1]);
        row.put("approved", stats[2]);
        row.put("rejected", stats[3]);
        challengeRows.add(row);
      }
      challengeRows.sort(Comparator.comparingInt(
          (Map<String, Object> r) -> (int) r.get("total")).reversed());

      Map<String, Map<String, Object>> byCategory = new LinkedHashMap<>();
      for (Map<String, Object> row : challengeRows) {
        String category = String.valueOf(row.get("category"));
        Map<String, Object> agg = byCategory.computeIfAbsent(category, k -> {
          Map<String, Object> fresh = new LinkedHashMap<>();
          fresh.put("category", k);
          fresh.put("challenges", 0);
          fresh.put("entries", 0);
          return fresh;
        });
        agg.put("challenges", (int) agg.get("challenges") + 1);
        agg.put("entries", (int) agg.get("entries") + (int) row.get("total"));
      }
      List<Map<String, Object>> categoryRows = new ArrayList<>(byCategory.values());
      for (Map<String, Object> agg : categoryRows) {
        int count = (int) agg.get("challenges");
        int total = (int) agg.get("entries");
        agg.put("avgPerChallenge", count == 0 ? 0 : Math.round((total / (double) count) * 10) / 10.0);
      }
      categoryRows.sort(Comparator.comparingInt(
          (Map<String, Object> r) -> (int) r.get("entries")).reversed());

      return ResponseEntity.ok(Map.of(
          "batches", todaysBatches(allEntries),
          "totals", Map.of(
              "challenges", challengeRows.size(),
              "entries", allEntries.size(),
              "challengesWithEntries",
              challengeRows.stream().filter(r -> (int) r.get("total") > 0).count()),
          "challenges", challengeRows,
          "categories", categoryRows));
    } catch (Exception e) {
      log.error("activityReport failed", e);
      return ApiErrors.internal(e);
    }
  }

  /** Moderation batches from today, newest first. */
  private static List<Map<String, Object>> todaysBatches(List<EntryEntity> allEntries) {
    // Midnight UTC. The original used the server's local midnight; UTC is used
    // here because every stored timestamp is UTC, so a local boundary would
    // include or drop entries depending on where the server happens to be.
    Instant startOfToday = LocalDate.now(ZoneOffset.UTC).atStartOfDay(ZoneOffset.UTC).toInstant();

    Map<String, Map<String, Object>> batches = new LinkedHashMap<>();
    for (EntryEntity e : allEntries) {
      if (e.getModeratedAt() == null || nz(e.getModerationBatchId()).isEmpty()) {
        continue;
      }
      if (e.getModeratedAt().isBefore(startOfToday)) {
        continue;
      }
      Map<String, Object> batch = batches.computeIfAbsent(e.getModerationBatchId(), k -> {
        Map<String, Object> fresh = new LinkedHashMap<>();
        fresh.put("batch_id", k);
        fresh.put("moderated_at", e.getModeratedAt());
        fresh.put("approved", 0);
        fresh.put("rejected", 0);
        fresh.put("pending", 0);
        fresh.put("total", 0);
        return fresh;
      });
      batch.put("total", (int) batch.get("total") + 1);
      String bucket = switch (bucketOf(e.getStatus())) {
        case 2 -> "approved";
        case 3 -> "rejected";
        default -> "pending";
      };
      batch.put(bucket, (int) batch.get(bucket) + 1);
      // The batch is stamped with its earliest entry — when the run started.
      Instant current = (Instant) batch.get("moderated_at");
      if (e.getModeratedAt().isBefore(current)) {
        batch.put("moderated_at", e.getModeratedAt());
      }
    }

    List<Map<String, Object>> out = new ArrayList<>(batches.values());
    out.sort(Comparator.comparing(
        (Map<String, Object> b) -> (Instant) b.get("moderated_at")).reversed());
    return out;
  }

  /** 1 = pending, 2 = approved, 3 = rejected — anything unrecognised is pending. */
  private static int bucketOf(String status) {
    if ("approved".equals(status)) {
      return 2;
    }
    if ("rejected".equals(status)) {
      return 3;
    }
    return 1;
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
