package com.fiftythree.challenges.intake;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fiftythree.challenges.entity.AudienceTypeEntity;
import com.fiftythree.challenges.entity.AudienceTypeRepository;
import com.fiftythree.challenges.entity.CategoryEntity;
import com.fiftythree.challenges.entity.CategoryRepository;
import com.fiftythree.challenges.entity.ChallengeMechanicEntity;
import com.fiftythree.challenges.entity.ChallengeMechanicRepository;
import com.fiftythree.challenges.entity.CompetitionPathwayRepository;
import com.fiftythree.challenges.entity.EvidenceRequirementRepository;
import com.fiftythree.challenges.entity.IntakeAnswerOptionEntity;
import com.fiftythree.challenges.entity.ParticipationModeRepository;
import com.fiftythree.challenges.entity.ScoringModelRepository;
import com.fiftythree.challenges.support.JsonColumn;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/**
 * The recommendation is what a corporate host is shown after filling in the
 * questionnaire, and what pre-populates their draft. The behaviours that matter
 * are the ranking arithmetic, the fact that a taxonomy record which has been
 * deleted does not silently shrink the result, and that the rationale traces
 * back to the host's own answers.
 */
class RecommendationEngineTest {

  private ChallengeMechanicRepository mechanics;
  private CategoryRepository categories;
  private AudienceTypeRepository audiences;

  private RecommendationEngine engine;

  @BeforeEach
  void setUp() {
    mechanics = mock(ChallengeMechanicRepository.class);
    categories = mock(CategoryRepository.class);
    audiences = mock(AudienceTypeRepository.class);
    ParticipationModeRepository modes = mock(ParticipationModeRepository.class);
    ScoringModelRepository scoring = mock(ScoringModelRepository.class);
    EvidenceRequirementRepository evidence = mock(EvidenceRequirementRepository.class);
    CompetitionPathwayRepository pathways = mock(CompetitionPathwayRepository.class);

    when(mechanics.findAll()).thenReturn(List.of());
    when(categories.findAll()).thenReturn(List.of());
    when(audiences.findAll()).thenReturn(List.of());
    when(modes.findAll()).thenReturn(List.of());
    when(scoring.findAll()).thenReturn(List.of());
    when(evidence.findAll()).thenReturn(List.of());
    when(pathways.findAll()).thenReturn(List.of());

    engine = new RecommendationEngine(new JsonColumn(new ObjectMapper()), mechanics, categories,
        modes, audiences, scoring, evidence, pathways);
  }

  @Test
  void weightsAccumulateAcrossAnswers() {
    when(mechanics.findAll()).thenReturn(List.of(
        mechanic("m1", "Photo contest"), mechanic("m2", "Live heat")));

    // m1 named by both answers at weight 3 and 2; m2 by one at weight 2.
    RecommendationEngine.Recommendation result = engine.recommend(List.of(
        option("Weekly photos", 3, "[\"m1\"]"),
        option("Live final", 2, "[\"m1\",\"m2\"]")));

    List<RecommendationEngine.Scored> ranked = result.get("mechanic");
    assertEquals(2, ranked.size());
    assertEquals("m1", ranked.get(0).id());
    assertEquals(5.0, ranked.get(0).score());
    assertEquals("m2", ranked.get(1).id());
    assertEquals(2.0, ranked.get(1).score());
    assertEquals("Photo contest", ranked.get(0).name());
  }

  @Test
  void anOptionWithNoWeightCountsAsOne() {
    // An unweighted questionnaire should still rank by how often an id is
    // named, rather than scoring everything zero and returning an arbitrary
    // order.
    when(mechanics.findAll()).thenReturn(List.of(mechanic("m1", "Photo contest")));

    RecommendationEngine.Recommendation result = engine.recommend(List.of(
        option("A", null, "[\"m1\"]"),
        option("B", null, "[\"m1\"]")));

    assertEquals(2.0, result.get("mechanic").get(0).score());
  }

  @Test
  void eachDimensionIsCappedAtItsOwnTopN() {
    // Mechanics keep three, categories only two. Getting the caps wrong
    // overwhelms the results screen or hides a real recommendation.
    when(mechanics.findAll()).thenReturn(List.of(
        mechanic("m1", "One"), mechanic("m2", "Two"),
        mechanic("m3", "Three"), mechanic("m4", "Four")));
    when(categories.findAll()).thenReturn(List.of(
        category("c1", "Alpha"), category("c2", "Beta"), category("c3", "Gamma")));

    RecommendationEngine.Recommendation result = engine.recommend(List.of(
        optionWithCategories("All", 1,
            "[\"m1\",\"m2\",\"m3\",\"m4\"]", "[\"c1\",\"c2\",\"c3\"]")));

    assertEquals(3, result.get("mechanic").size());
    assertEquals(2, result.get("category").size());
  }

  @Test
  void anIdWithNoMatchingRecordStillAppearsAsUnknown() {
    // The taxonomy record was deleted but the option still names it. Dropping
    // it would make the recommendation look thinner than the answers were, and
    // hide the dangling reference from whoever has to fix it.
    when(mechanics.findAll()).thenReturn(List.of(mechanic("m1", "Photo contest")));

    RecommendationEngine.Recommendation result = engine.recommend(List.of(
        option("A", 5, "[\"deleted-id\"]")));

    assertEquals(1, result.get("mechanic").size());
    assertEquals("(unknown)", result.get("mechanic").get(0).name());
    assertEquals("deleted-id", result.get("mechanic").get(0).id());
  }

  @Test
  void aDimensionNobodyAnsweredForComesBackEmpty() {
    RecommendationEngine.Recommendation result =
        engine.recommend(List.of(option("A", 1, "[]")));

    assertEquals(List.of(), result.get("mechanic"));
    assertEquals(List.of(), result.get("audience"));
  }

  @Test
  void complianceFlagsAreCollectedAcrossAnswersWithoutDuplicates() {
    IntakeAnswerOptionEntity first = option("Kids involved", 1, "[]");
    first.setComplianceFlags("[\"minors\",\"permit\"]");
    IntakeAnswerOptionEntity second = option("Prizes over $5k", 1, "[]");
    second.setComplianceFlags("[\"permit\"]");

    RecommendationEngine.Recommendation result = engine.recommend(List.of(first, second));

    assertEquals(List.of("minors", "permit"), result.complianceFlags());
  }

  @Test
  void theFirstAnswerNamingAServiceTierWins() {
    // Later answers do not overwrite it, so the questionnaire's own ordering
    // decides which tier a host lands on.
    IntakeAnswerOptionEntity first = option("Enterprise scale", 1, "[]");
    first.setServiceTierId("tier-enterprise");
    IntakeAnswerOptionEntity second = option("Small team", 1, "[]");
    second.setServiceTierId("tier-standard");

    assertEquals("tier-enterprise",
        engine.recommend(List.of(first, second)).serviceTierId());
  }

  @Test
  void theRationaleNamesTheAnswersThatDroveTheResult() {
    // A host reading the results screen should be able to see the
    // recommendation came from what they said, not from an opaque verdict.
    when(mechanics.findAll()).thenReturn(List.of(mechanic("m1", "Photo contest")));
    when(audiences.findAll()).thenReturn(List.of(audience("a1", "Staff")));

    IntakeAnswerOptionEntity option = option("Weekly photos", 2, "[\"m1\"]");
    option.setAudienceIds("[\"a1\"]");
    option.setComplianceFlags("[\"minors\"]");

    String rationale = engine.recommend(List.of(option)).rationaleSummary();

    assertTrue(rationale.contains("Mechanics: Photo contest"), rationale);
    assertTrue(rationale.contains("Audience: Staff"), rationale);
    assertTrue(rationale.contains("\"Weekly photos\""), rationale);
    assertTrue(rationale.contains("Compliance flags raised: minors"), rationale);
  }

  @Test
  void noAnswersProducesAnEmptyRecommendationRatherThanFailing() {
    RecommendationEngine.Recommendation result = engine.recommend(List.of());

    assertEquals(List.of(), result.get("mechanic"));
    assertEquals(List.of(), result.complianceFlags());
    assertEquals("", result.serviceTierId());
    assertEquals("", result.rationaleSummary());
  }

  // ------------------------------------------------------------ fixtures

  private static IntakeAnswerOptionEntity option(
      String label, Integer weight, String mechanicIds) {
    IntakeAnswerOptionEntity option = new IntakeAnswerOptionEntity();
    option.setId("opt-" + label.hashCode());
    option.setLabel(label);
    option.setWeight(weight == null ? null : weight.doubleValue());
    option.setMechanicIds(mechanicIds);
    return option;
  }

  private static IntakeAnswerOptionEntity optionWithCategories(
      String label, Integer weight, String mechanicIds, String categoryIds) {
    IntakeAnswerOptionEntity option = option(label, weight, mechanicIds);
    option.setCategoryIds(categoryIds);
    return option;
  }

  private static ChallengeMechanicEntity mechanic(String id, String name) {
    ChallengeMechanicEntity m = new ChallengeMechanicEntity();
    m.setId(id);
    m.setName(name);
    m.setSlug(name.toLowerCase().replace(' ', '_'));
    return m;
  }

  private static CategoryEntity category(String id, String name) {
    CategoryEntity c = new CategoryEntity();
    c.setId(id);
    c.setName(name);
    return c;
  }

  private static AudienceTypeEntity audience(String id, String name) {
    AudienceTypeEntity a = new AudienceTypeEntity();
    a.setId(id);
    a.setName(name);
    return a;
  }
}
