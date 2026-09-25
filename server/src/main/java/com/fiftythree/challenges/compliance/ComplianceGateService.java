package com.fiftythree.challenges.compliance;

import com.fiftythree.challenges.entity.ComplianceGateEntity;
import com.fiftythree.challenges.entity.PromoterAppointmentEntity;
import com.fiftythree.challenges.entity.VotingConfigurationEntity;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import org.springframework.stereotype.Service;

/**
 * Whether a challenge's interim legal gate may be cleared.
 *
 * <p>{@code launch_blocked} starts true and can only be set false when every
 * condition is satisfied. The conditions cover legal review, the promoter
 * appointment, terms, minor participation, voting, permits and prize funding —
 * each one a thing that can make a competition unlawful to run, which is why
 * clearing is checked here rather than trusted to the admin screen.
 */
@Service
public class ComplianceGateService {

  /** The fields an admin may change on a gate. Nothing else is writable. */
  public static final List<String> UPDATABLE_FIELDS = List.of(
      "legal_review_status",
      "promoter_confirmed",
      "terms_approved",
      "minor_participation_reviewed",
      "voting_reviewed",
      "permit_position_recorded",
      "prize_funding_confirmed",
      "launch_blocked",
      "legal_review_reference",
      "gate_notes");

  /**
   * Voting arrangements that need a legal opinion first.
   *
   * <p>Where a public vote decides or materially weights the winner, the
   * competition can fall under trade-promotion rules — so a recorded legal
   * opinion is required before it can go live.
   */
  private static final Set<String> VOTING_PURPOSES_REQUIRING_LEGAL =
      Set.of("determines_winner", "weighted_component");

  private final PromoterAppointmentQueryRepository promoters;
  private final VotingConfigurationQueryRepository votingConfigs;

  public ComplianceGateService(
      PromoterAppointmentQueryRepository promoters,
      VotingConfigurationQueryRepository votingConfigs) {
    this.promoters = promoters;
    this.votingConfigs = votingConfigs;
  }

  /** Conditions on the gate record itself that are not yet met. */
  public List<String> unmetConditions(ComplianceGateEntity gate) {
    List<String> out = new ArrayList<>();
    if (gate == null) {
      out.add("gate missing");
      return out;
    }
    if (!"cleared".equals(nz(gate.getLegalReviewStatus()))) {
      out.add("legal_review_status must be 'cleared'");
    }
    if (!Boolean.TRUE.equals(gate.getPromoterConfirmed())) {
      out.add("promoter_confirmed");
    }
    if (!Boolean.TRUE.equals(gate.getTermsApproved())) {
      out.add("terms_approved");
    }
    if (!Boolean.TRUE.equals(gate.getMinorParticipationReviewed())) {
      out.add("minor_participation_reviewed");
    }
    if (!Boolean.TRUE.equals(gate.getVotingReviewed())) {
      out.add("voting_reviewed");
    }
    if (!Boolean.TRUE.equals(gate.getPermitPositionRecorded())) {
      out.add("permit_position_recorded");
    }
    if (!Boolean.TRUE.equals(gate.getPrizeFundingConfirmed())) {
      out.add("prize_funding_confirmed");
    }
    if (nz(gate.getLegalReviewReference()).trim().isEmpty()) {
      out.add("legal_review_reference");
    }
    return out;
  }

  /**
   * The full check, including records held elsewhere.
   *
   * <p>Ticking "promoter_confirmed" on the gate is not the same as a promoter
   * actually being appointed — the appointment record is the only source of
   * truth for that, so both are required.
   */
  public Clearance evaluate(ComplianceGateEntity gate) {
    List<String> missing = unmetConditions(gate);

    String challengeId = gate == null ? "" : nz(gate.getChallengeId());
    if (challengeId.isEmpty()) {
      missing.add("challenge_id missing (cannot verify promoter/voting records)");
      return new Clearance(false, missing);
    }

    if (promoters.findLatestFor(challengeId).isEmpty()) {
      missing.add("promoter_appointment (no PromoterAppointment record)");
    }

    VotingConfigurationEntity voting =
        votingConfigs.findLatestFor(challengeId).stream().findFirst().orElse(null);
    if (voting != null) {
      String purpose = nz(voting.getVotingPurpose());
      if (VOTING_PURPOSES_REQUIRING_LEGAL.contains(purpose)
          && nz(voting.getLegalOpinionReference()).trim().isEmpty()) {
        missing.add("voting_legal_opinion (voting_purpose='" + purpose
            + "' requires legal_opinion_reference)");
      }
    }

    return new Clearance(missing.isEmpty(), missing);
  }

  public record Clearance(boolean canClear, List<String> missing) {}

  private static String nz(String v) {
    return v == null ? "" : v;
  }
}
