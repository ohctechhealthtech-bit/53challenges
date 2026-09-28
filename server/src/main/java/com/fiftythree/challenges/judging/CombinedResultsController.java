package com.fiftythree.challenges.judging;

import com.fasterxml.jackson.databind.JsonNode;
import com.fiftythree.challenges.entity.CombinedResultEntity;
import com.fiftythree.challenges.entity.JudgingPanelEntity;
import com.fiftythree.challenges.entity.JudgingPanelRepository;
import com.fiftythree.challenges.entity.ScoreEntity;
import com.fiftythree.challenges.security.CallerResolver;
import com.fiftythree.challenges.support.JsonColumn;
import com.fiftythree.challenges.vote.VoteRepository;
import com.fiftythree.challenges.support.ApiErrors;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/**
 * The Java replacement for {@code computeCombinedResults}.
 *
 * <p>Produces the final standing per entry from the judging score and the
 * public vote, weighted by the panel ({@code judge_weight} default 0.7,
 * {@code public_weight} default 0.3). Each component is normalised to 0–100
 * first, so a 10-point judging scale and a raw vote tally can be added
 * together at all.
 *
 * <p>This decides who wins a competition, so the arithmetic is kept identical
 * to the original rather than tidied: same normalisation, same rounding, same
 * treatment of entries missing one of the two inputs.
 */
@RestController
public class CombinedResultsController {

  private static final Logger log = LoggerFactory.getLogger(CombinedResultsController.class);

  private static final double DEFAULT_JUDGE_WEIGHT = 0.7;
  private static final double DEFAULT_PUBLIC_WEIGHT = 0.3;
  private static final double DEFAULT_SCALE_MAX = 10;

  private final JudgingPanelRepository panels;
  private final ScoreQueryRepository scores;
  private final CombinedResultQueryRepository results;
  private final VoteRepository votes;
  private final JsonColumn json;
  private final CallerResolver caller;

  public CombinedResultsController(
      JudgingPanelRepository panels,
      ScoreQueryRepository scores,
      CombinedResultQueryRepository results,
      VoteRepository votes,
      JsonColumn json,
      CallerResolver caller) {
    this.panels = panels;
    this.scores = scores;
    this.results = results;
    this.votes = votes;
    this.json = json;
    this.caller = caller;
  }

  @PostMapping("/api/apps/{appId}/functions/computeCombinedResults")
  @Transactional
  public ResponseEntity<?> handle(@RequestBody(required = false) Map<String, Object> body) {
    Map<String, Object> request = body == null ? Map.of() : body;

    // Admin-only. This deletes every existing result for the challenge,
    // rewrites them, and with lock:true sets results_locked — which decides
    // who won and cannot be undone. The Base44 original checked nothing at
    // all, so any anonymous caller could rewrite a competition's outcome.
    String sessionToken = str(request.get("session_token"));
    if (caller.email(sessionToken) == null) {
      return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
    }
    if (!caller.isAdmin(sessionToken)) {
      return ResponseEntity.status(403).body(Map.of("error", "Admin only"));
    }

    String panelId = str(request.get("panel_id"));
    if (panelId.isEmpty()) {
      return ResponseEntity.badRequest().body(Map.of("error", "Missing panel_id"));
    }

    try {
      JudgingPanelEntity panel = panels.findById(panelId).orElse(null);
      if (panel == null) {
        return ResponseEntity.status(404).body(Map.of("error", "Panel not found"));
      }

      double jw = panel.getJudgeWeight() == null ? DEFAULT_JUDGE_WEIGHT : panel.getJudgeWeight();
      double pw = panel.getPublicWeight() == null ? DEFAULT_PUBLIC_WEIGHT : panel.getPublicWeight();
      double scaleMax =
          panel.getScaleMax() == null || panel.getScaleMax() == 0
              ? DEFAULT_SCALE_MAX
              : panel.getScaleMax();
      String challengeId = str(panel.getCompetitionId());

      List<JsonNode> criteria = json.nodes(panel.getCriteria());
      // Criterion weights sum to the denominator. Falling back to 1 keeps a
      // panel with no criteria from dividing by zero and returning NaN scores.
      double weightTotal = 0;
      Map<String, Double> weightByName = new HashMap<>();
      for (JsonNode c : criteria) {
        double w = c.path("weight").isNumber() ? c.path("weight").asDouble() : 1;
        weightByName.put(c.path("name").asText(""), w);
        weightTotal += w;
      }
      if (weightTotal == 0) {
        weightTotal = 1;
      }

      // --- judge component -------------------------------------------------
      Map<String, List<Double>> judgePercents = new LinkedHashMap<>();
      Map<String, Integer> judgeCounts = new LinkedHashMap<>();
      for (ScoreEntity s : scores.findCountable(panelId)) {
        double sum = 0;
        for (JsonNode sc : json.nodes(s.getScores())) {
          double weight = weightByName.getOrDefault(sc.path("name").asText(""), 1.0);
          sum += sc.path("value").asDouble(0) * weight;
        }
        double pct = (sum / (weightTotal * scaleMax)) * 100;
        judgePercents.computeIfAbsent(s.getEntryId(), k -> new ArrayList<>()).add(pct);
        judgeCounts.merge(s.getEntryId(), 1, Integer::sum);
      }
      Map<String, Double> judgeScore = new LinkedHashMap<>();
      judgePercents.forEach((entryId, list) ->
          judgeScore.put(entryId, list.stream().mapToDouble(Double::doubleValue).average().orElse(0)));

      // --- public component ------------------------------------------------
      Map<String, Long> publicVotes = new LinkedHashMap<>();
      for (Object[] row : votes.countsByEntry(challengeId)) {
        publicVotes.put((String) row[0], (Long) row[1]);
      }
      // Normalised against the leader, not against a fixed maximum: the public
      // score is a share of the best-performing entry. max(1, …) keeps a
      // challenge with no votes from dividing by zero.
      long maxVotes = Math.max(1, publicVotes.values().stream().mapToLong(Long::longValue).max().orElse(0));
      Map<String, Double> publicScore = new LinkedHashMap<>();
      publicVotes.forEach((entryId, count) -> publicScore.put(entryId, (count / (double) maxVotes) * 100));

      // --- combine ---------------------------------------------------------
      LinkedHashSet<String> entryIds = new LinkedHashSet<>(judgeScore.keySet());
      entryIds.addAll(publicVotes.keySet());

      List<CombinedResultEntity> rows = new ArrayList<>();
      List<Map<String, Object>> payload = new ArrayList<>();
      Instant computedAt = Instant.now();

      for (String entryId : entryIds) {
        boolean hasJudge = judgeScore.containsKey(entryId);
        boolean hasPublic = publicVotes.containsKey(entryId);
        double j = hasJudge ? judgeScore.get(entryId) : (hasPublic ? publicScore.get(entryId) : 0);
        double p = hasPublic ? publicScore.get(entryId) : (hasJudge ? judgeScore.get(entryId) : 0);

        // With only one source available its weight collapses to 1. Otherwise
        // an unjudged entry would be scored at 30% of its own public result
        // and rank below entries that are genuinely worse.
        double jwEff = jw;
        double pwEff = pw;
        if (hasJudge && !hasPublic) {
          jwEff = 1;
          pwEff = 0;
        } else if (hasPublic && !hasJudge) {
          jwEff = 0;
          pwEff = 1;
        }

        CombinedResultEntity r = new CombinedResultEntity();
        r.setId(newId());
        r.setEntryId(entryId);
        r.setChallengeId(challengeId);
        r.setPanelId(panelId);
        r.setJudgeScore(round(j));
        r.setPublicScore(round(p));
        r.setPublicVotes((double) publicVotes.getOrDefault(entryId, 0L));
        r.setJudgeCount((double) judgeCounts.getOrDefault(entryId, 0));
        r.setCombinedScore(round(jwEff * j + pwEff * p));
        r.setComputedAt(computedAt);
        r.setCreatedDate(computedAt);
        r.setUpdatedDate(computedAt);
        r.setIsSample(false);
        rows.add(r);
      }

      rows.sort((a, b) -> Double.compare(b.getCombinedScore(), a.getCombinedScore()));
      for (int i = 0; i < rows.size(); i++) {
        rows.get(i).setCombinedRank((double) (i + 1));
        payload.add(asMap(rows.get(i)));
      }

      results.deleteByChallengeId(challengeId);
      if (!rows.isEmpty()) {
        results.saveAll(rows);
      }

      if (Boolean.TRUE.equals(request.get("lock"))) {
        panel.setStatus("complete");
        panel.setResultsLocked(true);
        panel.setResultsLockedAt(computedAt);
        panels.save(panel);
      }

      return ResponseEntity.ok(Map.of(
          "success", true,
          "results", payload,
          "weights", Map.of("judge", jw, "public", pw)));
    } catch (Exception e) {
      log.error("computeCombinedResults failed for panel {}", panelId, e);
      return ApiErrors.internal(e);
    }
  }

  private static Map<String, Object> asMap(CombinedResultEntity r) {
    Map<String, Object> m = new LinkedHashMap<>();
    m.put("entry_id", r.getEntryId());
    m.put("challenge_id", r.getChallengeId());
    m.put("panel_id", r.getPanelId());
    m.put("judge_score", r.getJudgeScore());
    m.put("public_score", r.getPublicScore());
    m.put("public_votes", r.getPublicVotes());
    m.put("judge_count", r.getJudgeCount());
    m.put("combined_score", r.getCombinedScore());
    m.put("combined_rank", r.getCombinedRank());
    m.put("computed_at", r.getComputedAt());
    return m;
  }

  /**
   * JavaScript's {@code Number.EPSILON}: 2^-52, the gap between 1.0 and the
   * next double. {@code Math.ulp(1.0)} is that same constant.
   *
   * <p>Not {@code Math.ulp(n)}, which scales with the magnitude of n and around
   * 100 is roughly sixty times larger. The nudge only matters for a value
   * sitting exactly on a .xx5 boundary, but this function decides competition
   * rankings, so it matches the original rather than approximating it.
   */
  private static final double JS_EPSILON = Math.ulp(1.0);

  /** Two decimal places, matching the original's rounding exactly. */
  private static double round(double n) {
    return Math.round((n + JS_EPSILON) * 100) / 100.0;
  }

  private static String newId() {
    return UUID.randomUUID().toString().replace("-", "").substring(0, 24);
  }

  private static String str(Object v) {
    return v == null ? "" : String.valueOf(v);
  }
}
