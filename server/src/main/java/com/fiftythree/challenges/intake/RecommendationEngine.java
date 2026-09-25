package com.fiftythree.challenges.intake;

import com.fiftythree.challenges.entity.AudienceTypeEntity;
import com.fiftythree.challenges.entity.CategoryEntity;
import com.fiftythree.challenges.entity.CategoryRepository;
import com.fiftythree.challenges.entity.ChallengeMechanicEntity;
import com.fiftythree.challenges.entity.ChallengeMechanicRepository;
import com.fiftythree.challenges.entity.CompetitionPathwayEntity;
import com.fiftythree.challenges.entity.CompetitionPathwayRepository;
import com.fiftythree.challenges.entity.EvidenceRequirementEntity;
import com.fiftythree.challenges.entity.EvidenceRequirementRepository;
import com.fiftythree.challenges.entity.IntakeAnswerOptionEntity;
import com.fiftythree.challenges.entity.AudienceTypeRepository;
import com.fiftythree.challenges.entity.ParticipationModeEntity;
import com.fiftythree.challenges.entity.ParticipationModeRepository;
import com.fiftythree.challenges.entity.ScoringModelEntity;
import com.fiftythree.challenges.entity.ScoringModelRepository;
import com.fiftythree.challenges.support.JsonColumn;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.function.Supplier;
import org.springframework.stereotype.Service;

/**
 * Turns a host's questionnaire answers into a challenge recommendation. A port
 * of {@code base44/shared/corporateIntakeHelper.ts}.
 *
 * <p>Pure weighted aggregation over the existing taxonomy. Each answer option
 * carries lists of taxonomy record ids and a weight; choosing it adds that
 * weight to every id it names, and the top few per dimension become the
 * recommendation. <b>There is no category-specific logic anywhere here and no
 * hard-coded questionnaire content</b> — which is what lets the questionnaire
 * be rewritten as data without touching this code.
 */
@Service
public class RecommendationEngine {

  /**
   * One recommendation dimension: where its ids live on an answer option, how
   * many to return, and how to resolve them to names.
   */
  private record Dimension(
      String key,
      Function<IntakeAnswerOptionEntity, String> idsColumn,
      int topN,
      String label,
      Supplier<List<Named>> records) {}

  /** A taxonomy record reduced to what the recommendation needs. */
  public record Named(String id, String name, String slug) {}

  /** One recommended record with the weight that put it there. */
  public record Scored(String id, String name, String slug, double score) {

    public Map<String, Object> toMap() {
      Map<String, Object> out = new LinkedHashMap<>();
      out.put("id", id);
      out.put("name", name);
      out.put("slug", slug);
      out.put("score", score);
      return out;
    }
  }

  /** The finished recommendation, keyed by dimension. */
  public record Recommendation(
      Map<String, List<Scored>> byDimension,
      List<String> complianceFlags,
      String serviceTierId,
      String rationaleSummary) {

    public List<Scored> get(String key) {
      return byDimension.getOrDefault(key, List.of());
    }
  }

  private final JsonColumn json;
  private final List<Dimension> dimensions;

  public RecommendationEngine(
      JsonColumn json,
      ChallengeMechanicRepository mechanics,
      CategoryRepository categories,
      ParticipationModeRepository modes,
      AudienceTypeRepository audiences,
      ScoringModelRepository scoring,
      EvidenceRequirementRepository evidence,
      CompetitionPathwayRepository pathways) {

    this.json = json;
    // The order matters only for the rationale sentence, which reads in this
    // sequence. The keys are what the stored recommendation is keyed by.
    this.dimensions = List.of(
        new Dimension("mechanic", IntakeAnswerOptionEntity::getMechanicIds, 3, "Mechanics",
            () -> named(mechanics.findAll(), ChallengeMechanicEntity::getId,
                ChallengeMechanicEntity::getName, ChallengeMechanicEntity::getSlug)),
        new Dimension("category", IntakeAnswerOptionEntity::getCategoryIds, 2, "Activity area",
            () -> named(categories.findAll(), CategoryEntity::getId,
                CategoryEntity::getName, CategoryEntity::getSlug)),
        new Dimension("mode", IntakeAnswerOptionEntity::getModeIds, 2, "Participation mode",
            () -> named(modes.findAll(), ParticipationModeEntity::getId,
                ParticipationModeEntity::getName, ParticipationModeEntity::getSlug)),
        new Dimension("audience", IntakeAnswerOptionEntity::getAudienceIds, 3, "Audience",
            () -> named(audiences.findAll(), AudienceTypeEntity::getId,
                AudienceTypeEntity::getName, AudienceTypeEntity::getSlug)),
        new Dimension("scoring", IntakeAnswerOptionEntity::getScoringIds, 2, "Scoring model",
            () -> named(scoring.findAll(), ScoringModelEntity::getId,
                ScoringModelEntity::getName, ScoringModelEntity::getSlug)),
        new Dimension("evidence", IntakeAnswerOptionEntity::getEvidenceIds, 3, "Evidence",
            () -> named(evidence.findAll(), EvidenceRequirementEntity::getId,
                EvidenceRequirementEntity::getName, EvidenceRequirementEntity::getSlug)),
        new Dimension("pathway", IntakeAnswerOptionEntity::getPathwayIds, 2, "Pathway",
            () -> named(pathways.findAll(), CompetitionPathwayEntity::getId,
                CompetitionPathwayEntity::getName, CompetitionPathwayEntity::getSlug)));
  }

  private static <T> List<Named> named(
      List<T> rows,
      Function<T, String> id,
      Function<T, String> name,
      Function<T, String> slug) {

    List<Named> out = new ArrayList<>();
    for (T row : rows) {
      out.add(new Named(id.apply(row), name.apply(row), nz(slug.apply(row))));
    }
    return out;
  }

  /** Builds the recommendation from the options the host actually chose. */
  public Recommendation recommend(List<IntakeAnswerOptionEntity> selected) {
    Map<String, Map<String, Double>> scores = new LinkedHashMap<>();
    LinkedHashSet<String> flags = new LinkedHashSet<>();
    String serviceTierId = "";

    for (IntakeAnswerOptionEntity option : selected) {
      flags.addAll(json.stringList(option.getComplianceFlags()));
      // First option that names a tier wins; later ones do not overwrite it,
      // so the questionnaire's own ordering decides.
      if (serviceTierId.isEmpty() && notBlank(option.getServiceTierId())) {
        serviceTierId = option.getServiceTierId();
      }
      // An option with no weight counts as 1, so an unweighted questionnaire
      // still ranks by how often an id is named.
      double weight = option.getWeight() == null ? 1 : option.getWeight();

      for (Dimension dimension : dimensions) {
        for (String id : json.stringList(dimension.idsColumn().apply(option))) {
          scores.computeIfAbsent(dimension.key(), k -> new LinkedHashMap<>())
              .merge(id, weight, Double::sum);
        }
      }
    }

    Map<String, List<Scored>> byDimension = new LinkedHashMap<>();
    List<String> rationaleParts = new ArrayList<>();

    for (Dimension dimension : dimensions) {
      Map<String, Double> dimensionScores = scores.getOrDefault(dimension.key(), Map.of());
      if (dimensionScores.isEmpty()) {
        byDimension.put(dimension.key(), List.of());
        continue;
      }

      Map<String, Named> byId = new LinkedHashMap<>();
      for (Named record : dimension.records().get()) {
        byId.putIfAbsent(record.id(), record);
      }

      List<Scored> top = dimensionScores.entrySet().stream()
          .sorted(Map.Entry.<String, Double>comparingByValue().reversed()
              .thenComparing(Map.Entry.comparingByKey()))
          .limit(dimension.topN())
          .map(e -> {
            Named record = byId.get(e.getKey());
            // An id with no matching record still appears, labelled unknown.
            // Dropping it silently would make a recommendation look thinner
            // than the answers actually were.
            return new Scored(e.getKey(),
                record == null ? "(unknown)" : record.name(),
                record == null ? "" : record.slug(),
                e.getValue());
          })
          .toList();

      byDimension.put(dimension.key(), top);
      if (!top.isEmpty()) {
        rationaleParts.add(dimension.label() + ": "
            + String.join(", ", top.stream().map(Scored::name).toList()));
      }
    }

    return new Recommendation(byDimension, List.copyOf(flags), serviceTierId,
        rationale(rationaleParts, selected, List.copyOf(flags)));
  }

  /**
   * A plain-language explanation of which answers drove which recommendations.
   *
   * <p>Written for a host to read on the results screen, not for logs. The
   * point is that the recommendation is traceable to their own answers rather
   * than arriving as an unexplained verdict.
   */
  private String rationale(
      List<String> rationaleParts,
      List<IntakeAnswerOptionEntity> selected,
      List<String> flags) {

    List<String> drivers = new ArrayList<>();
    for (IntakeAnswerOptionEntity option : selected) {
      List<String> drives = new ArrayList<>();
      for (Dimension dimension : dimensions) {
        if (!json.stringList(dimension.idsColumn().apply(option)).isEmpty()) {
          drives.add(dimension.label());
        }
      }
      List<String> optionFlags = json.stringList(option.getComplianceFlags());
      if (!optionFlags.isEmpty()) {
        drives.add("flags: " + String.join(", ", optionFlags));
      }
      if (notBlank(option.getServiceTierId())) {
        drives.add("service tier");
      }
      if (!drives.isEmpty()) {
        drivers.add("\"" + nz(option.getLabel()) + "\" → " + String.join("; ", drives));
      }
    }

    List<String> sentences = new ArrayList<>();
    if (!rationaleParts.isEmpty()) {
      sentences.add("Recommended: " + String.join(" | ", rationaleParts) + ".");
    }
    if (!drivers.isEmpty()) {
      sentences.add("Driven by answers: " + String.join(" | ", drivers) + ".");
    }
    if (!flags.isEmpty()) {
      sentences.add("Compliance flags raised: " + String.join(", ", flags) + ".");
    }
    return String.join(" ", sentences);
  }

  private static boolean notBlank(String value) {
    return value != null && !value.isBlank();
  }

  private static String nz(String value) {
    return value == null ? "" : value;
  }
}
