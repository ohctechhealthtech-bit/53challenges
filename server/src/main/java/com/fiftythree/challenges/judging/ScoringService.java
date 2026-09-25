package com.fiftythree.challenges.judging;

import com.fasterxml.jackson.databind.JsonNode;
import com.fiftythree.challenges.entity.JudgingPanelEntity;
import com.fiftythree.challenges.entity.ScoreEntity;
import com.fiftythree.challenges.support.JsonColumn;
import com.fiftythree.challenges.vote.VoteRepository;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;

/**
 * The combined judge-and-public score for every entry on a panel.
 *
 * <p>Shared by {@code computeCombinedResults}, which writes the results, and
 * {@code auditCompetition}, which recomputes them to check the stored ones.
 * The original had two copies of this arithmetic. Sharing it means the audit
 * verifies the <em>data</em> — that stored results still match what the current
 * scores and votes produce, catching staleness or tampering — rather than
 * comparing two implementations that could drift apart and make every audit
 * either always pass or always fail for the wrong reason.
 */
@Service
public class ScoringService {

  private static final double DEFAULT_JUDGE_WEIGHT = 0.7;
  private static final double DEFAULT_PUBLIC_WEIGHT = 0.3;
  private static final double DEFAULT_SCALE_MAX = 10;

  /** JavaScript's Number.EPSILON, matching the original's rounding exactly. */
  private static final double JS_EPSILON = Math.ulp(1.0);

  private final ScoreQueryRepository scores;
  private final VoteRepository votes;
  private final JsonColumn json;

  public ScoringService(ScoreQueryRepository scores, VoteRepository votes, JsonColumn json) {
    this.scores = scores;
    this.votes = votes;
    this.json = json;
  }

  /** Computes every entry's standing, ranked best first. */
  public Result compute(JudgingPanelEntity panel, String challengeId) {
    if (panel == null) {
      return new Result(List.of(), Map.of(), DEFAULT_JUDGE_WEIGHT, DEFAULT_PUBLIC_WEIGHT);
    }

    double judgeWeight = panel.getJudgeWeight() == null
        ? DEFAULT_JUDGE_WEIGHT : panel.getJudgeWeight();
    double publicWeight = panel.getPublicWeight() == null
        ? DEFAULT_PUBLIC_WEIGHT : panel.getPublicWeight();
    double scaleMax = panel.getScaleMax() == null || panel.getScaleMax() == 0
        ? DEFAULT_SCALE_MAX : panel.getScaleMax();

    // Criterion weights form the denominator; falling back to 1 stops a panel
    // with no criteria producing NaN for every entry.
    Map<String, Double> weightByName = new HashMap<>();
    double weightTotal = 0;
    for (JsonNode c : json.nodes(panel.getCriteria())) {
      double w = c.path("weight").isNumber() ? c.path("weight").asDouble() : 1;
      weightByName.put(c.path("name").asText(""), w);
      weightTotal += w;
    }
    if (weightTotal == 0) {
      weightTotal = 1;
    }

    // Only submitted and locked scores count — a draft is a judge's work in
    // progress, not an opinion they have given.
    Map<String, List<Double>> judgePercents = new LinkedHashMap<>();
    Map<String, Integer> judgeCounts = new LinkedHashMap<>();
    for (ScoreEntity s : scores.findCountable(panel.getId())) {
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
    judgePercents.forEach((entryId, list) -> judgeScore.put(entryId,
        list.stream().mapToDouble(Double::doubleValue).average().orElse(0)));

    Map<String, Long> publicVotes = new LinkedHashMap<>();
    for (Object[] row : votes.countsByEntry(challengeId)) {
      publicVotes.put((String) row[0], (Long) row[1]);
    }
    // The public score is a share of the leader's, not of a fixed maximum.
    long maxVotes = Math.max(1,
        publicVotes.values().stream().mapToLong(Long::longValue).max().orElse(0));
    Map<String, Double> publicScore = new LinkedHashMap<>();
    publicVotes.forEach((entryId, count) ->
        publicScore.put(entryId, (count / (double) maxVotes) * 100));

    LinkedHashSet<String> entryIds = new LinkedHashSet<>(judgeScore.keySet());
    entryIds.addAll(publicVotes.keySet());

    List<Row> rows = new ArrayList<>();
    for (String entryId : entryIds) {
      boolean hasJudge = judgeScore.containsKey(entryId);
      boolean hasPublic = publicVotes.containsKey(entryId);
      double j = hasJudge ? judgeScore.get(entryId) : (hasPublic ? publicScore.get(entryId) : 0);
      double p = hasPublic ? publicScore.get(entryId) : (hasJudge ? judgeScore.get(entryId) : 0);

      // With one source only, its weight collapses to 1 — otherwise an
      // unjudged entry scores 30% of its own result and ranks below entries
      // that genuinely did worse.
      double jw = judgeWeight;
      double pw = publicWeight;
      if (hasJudge && !hasPublic) {
        jw = 1;
        pw = 0;
      } else if (hasPublic && !hasJudge) {
        jw = 0;
        pw = 1;
      }

      rows.add(new Row(
          entryId,
          round(j),
          round(p),
          publicVotes.getOrDefault(entryId, 0L),
          judgeCounts.getOrDefault(entryId, 0),
          round(jw * j + pw * p),
          0));
    }

    rows.sort(Comparator.comparingDouble(Row::combinedScore).reversed());
    List<Row> ranked = new ArrayList<>(rows.size());
    Map<String, Row> byEntry = new LinkedHashMap<>();
    for (int i = 0; i < rows.size(); i++) {
      Row r = rows.get(i).withRank(i + 1);
      ranked.add(r);
      byEntry.put(r.entryId(), r);
    }
    return new Result(ranked, byEntry, judgeWeight, publicWeight);
  }

  /** Two decimal places, matching the original's rounding exactly. */
  public static double round(double n) {
    return Math.round((n + JS_EPSILON) * 100) / 100.0;
  }

  public record Row(
      String entryId,
      double judgeScore,
      double publicScore,
      long publicVotes,
      int judgeCount,
      double combinedScore,
      int combinedRank) {

    Row withRank(int rank) {
      return new Row(entryId, judgeScore, publicScore, publicVotes, judgeCount,
          combinedScore, rank);
    }

    /** The wire shape the clients expect. */
    public Map<String, Object> asMap() {
      Map<String, Object> m = new LinkedHashMap<>();
      m.put("entry_id", entryId);
      m.put("judge_score", judgeScore);
      m.put("public_score", publicScore);
      m.put("public_votes", publicVotes);
      m.put("judge_count", judgeCount);
      m.put("combined_score", combinedScore);
      m.put("combined_rank", combinedRank);
      return m;
    }
  }

  public record Result(
      List<Row> rows, Map<String, Row> byEntry, double judgeWeight, double publicWeight) {}
}
