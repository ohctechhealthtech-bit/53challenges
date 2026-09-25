package com.fiftythree.challenges.compliance;

import com.fasterxml.jackson.databind.JsonNode;
import com.fiftythree.challenges.entity.AudienceTypeEntity;
import com.fiftythree.challenges.entity.ChallengeMechanicEntity;
import com.fiftythree.challenges.entity.ChallengeRightsConfigurationEntity;
import com.fiftythree.challenges.entity.LaunchCompetitionEntity;
import com.fiftythree.challenges.entity.ParticipationModeEntity;
import com.fiftythree.challenges.entity.PromoterAppointmentEntity;
import com.fiftythree.challenges.entity.ScoringModelEntity;
import com.fiftythree.challenges.entity.VotingConfigurationEntity;
import com.fiftythree.challenges.support.JsonColumn;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.stereotype.Service;

/**
 * Flattens everything known about a challenge into the fact map that the
 * compliance rules and the terms assembler both evaluate against. A port of
 * {@code assembleFacts} in {@code base44/shared/complianceAssessmentEngine.ts}.
 *
 * <p>The flat map is the point. Rules and clause inclusion conditions are
 * stored as data — {@code {field, operator, value}} triples written by
 * non-programmers — so every fact they can name has to be a plain key with a
 * plain value. Keys are the snake_case names those stored conditions use, and
 * renaming one silently stops the rules that reference it from ever matching.
 *
 * <p>A caller-supplied override wins over anything looked up here, which is how
 * an admin runs a what-if assessment against a configuration that does not
 * exist yet.
 */
@Service
public class FactsAssembler {

  /** Rights scopes that amount to marketing use, tier 2 and tier 3. */
  private static final Set<String> MARKETING_SCOPES = Set.of(
      "platform_promotion", "challenge_recap", "social_repost",
      "sponsor_host_use", "attribution", "non_sublicensable",
      "testimonial_nil", "derivative_compilation", "future_campaigns");

  private final LaunchCompetitionQueryRepository launches;
  private final ChallengeMechanicQueryRepository mechanics;
  private final ScoringModelQueryRepository scoringModels;
  private final AudienceTypeQueryRepository audiences;
  private final ParticipationModeQueryRepository participations;
  private final VotingConfigurationQueryRepository votingConfigs;
  private final PromoterAppointmentQueryRepository promoters;
  private final RightsConfigurationQueryRepository rights;
  private final JsonColumn json;

  public FactsAssembler(
      LaunchCompetitionQueryRepository launches,
      ChallengeMechanicQueryRepository mechanics,
      ScoringModelQueryRepository scoringModels,
      AudienceTypeQueryRepository audiences,
      ParticipationModeQueryRepository participations,
      VotingConfigurationQueryRepository votingConfigs,
      PromoterAppointmentQueryRepository promoters,
      RightsConfigurationQueryRepository rights,
      JsonColumn json) {
    this.launches = launches;
    this.mechanics = mechanics;
    this.scoringModels = scoringModels;
    this.audiences = audiences;
    this.participations = participations;
    this.votingConfigs = votingConfigs;
    this.promoters = promoters;
    this.rights = rights;
    this.json = json;
  }

  /** Every fact known about one challenge, with {@code overrides} applied first. */
  public Map<String, Object> assemble(String challengeId, Map<String, Object> overrides) {
    String cid = String.valueOf(challengeId);
    Map<String, Object> facts = new LinkedHashMap<>();
    facts.put("challenge_id", cid);
    if (overrides != null) {
      facts.putAll(overrides);
    }

    addLaunchFacts(facts, cid);
    addVotingFacts(facts, cid);
    addPromoterFacts(facts, cid);
    addRightsFacts(facts, cid);

    return facts;
  }

  private void addLaunchFacts(Map<String, Object> facts, String cid) {
    List<LaunchCompetitionEntity> found = launches.findByChallengeId(cid);
    if (found.isEmpty()) {
      return;
    }
    LaunchCompetitionEntity comp = found.get(0);
    // An unset geography means national, not unknown: a competition with no
    // stated geography runs everywhere, which is the stricter reading.
    facts.put("geography", blank(comp.getGeography()) ? "national" : comp.getGeography());
    facts.put("mechanic_slug", nz(comp.getMechanic()));
    facts.put("scoring_model_slug", nz(comp.getScoringModel()));
    facts.put("audience_slug", nz(comp.getAudience()));
    facts.put("participation_slug", nz(comp.getParticipation()));
    facts.put("module_extensions", json.stringList(comp.getModuleExtensions()));

    if (!blank(comp.getMechanic())) {
      for (ChallengeMechanicEntity m : mechanics.findBySlug(comp.getMechanic())) {
        facts.put("mechanic_name", m.getName());
        facts.put("mechanic_module_extensions", json.stringList(m.getModuleExtensions()));
        break;
      }
    }
    if (!blank(comp.getScoringModel())) {
      for (ScoringModelEntity s : scoringModels.findBySlug(comp.getScoringModel())) {
        facts.put("scoring_automatic", s.getAutomatic());
        facts.put("scoring_judge_weight", s.getJudgeWeight());
        facts.put("scoring_public_weight", s.getPublicWeight());
        facts.put("scoring_judge_blind", s.getJudgeBlind());
        break;
      }
    }
    if (!blank(comp.getAudience())) {
      for (AudienceTypeEntity a : audiences.findBySlug(comp.getAudience())) {
        facts.put("audience_name", a.getName());
        break;
      }
    }
    if (!blank(comp.getParticipation())) {
      for (ParticipationModeEntity p : participations.findBySlug(comp.getParticipation())) {
        facts.put("participation_name", p.getName());
        break;
      }
    }
  }

  private void addVotingFacts(Map<String, Object> facts, String cid) {
    for (VotingConfigurationEntity vc : votingConfigs.findLatestFor(cid)) {
      facts.put("voting_purpose", nz(vc.getVotingPurpose()));
      facts.put("voting_paid_voting", vc.getPaidVoting());
      facts.put("voting_identity_verification", nz(vc.getIdentityVerification()));
      break;
    }
  }

  private void addPromoterFacts(Map<String, Object> facts, String cid) {
    for (PromoterAppointmentEntity pa : promoters.findLatestFor(cid)) {
      facts.put("promoter_type", nz(pa.getPromoterType()));
      break;
    }
  }

  private void addRightsFacts(Map<String, Object> facts, String cid) {
    List<ChallengeRightsConfigurationEntity> found = rights.findByChallengeId(cid);
    if (found.isEmpty()) {
      return;
    }
    ChallengeRightsConfigurationEntity cfg = found.get(0);
    String musicPolicy = blank(cfg.getMusicPolicy())
        ? "original_or_licensed_only" : cfg.getMusicPolicy();
    String thirdPartyPolicy = blank(cfg.getThirdPartyPolicy())
        ? "none_permitted" : cfg.getThirdPartyPolicy();

    facts.put("rights_music_policy", musicPolicy);
    facts.put("rights_third_party_policy", thirdPartyPolicy);

    boolean hasMarketingScopes = false;
    for (JsonNode scope : json.nodes(cfg.getIncludedScopeVersions())) {
      if (MARKETING_SCOPES.contains(scope.path("scope_code").asText(""))) {
        hasMarketingScopes = true;
        break;
      }
    }
    facts.put("rights_has_marketing_scopes", hasMarketingScopes);
    facts.put("rights_commercial_music_permitted",
        "commercial_music_display_only".equals(musicPolicy));
    facts.put("rights_third_parties_expected", !"none_permitted".equals(thirdPartyPolicy));
    facts.put("rights_ugc_marketing_use", hasMarketingScopes);
  }

  private static boolean blank(String value) {
    return value == null || value.isBlank();
  }

  private static String nz(String value) {
    return value == null ? "" : value;
  }
}
