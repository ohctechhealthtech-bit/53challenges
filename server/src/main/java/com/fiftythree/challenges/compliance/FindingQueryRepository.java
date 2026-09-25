package com.fiftythree.challenges.compliance;

import com.fiftythree.challenges.entity.ComplianceAssessmentFindingEntity;
import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface FindingQueryRepository
    extends JpaRepository<ComplianceAssessmentFindingEntity, String> {

  /** Open permit findings for one jurisdiction on one challenge. */
  @Query("select f from ComplianceAssessmentFindingEntity f "
      + "where f.challengeId = :challengeId and f.obligationType = 'permit_required' "
      + "and f.status = 'open' and f.jurisdictionCode = :jurisdiction "
      + "order by f.createdDate desc, f.id asc")
  List<ComplianceAssessmentFindingEntity> findOpenPermitFindings(
      @Param("challengeId") String challengeId, @Param("jurisdiction") String jurisdiction);

  /**
   * Blocking findings that are still unresolved.
   *
   * <p>Non-blocking findings are advisory and do not re-lock anything.
   */
  @Query("select f from ComplianceAssessmentFindingEntity f "
      + "where f.challengeId = :challengeId and f.blocking = true "
      + "and f.status in :statuses order by f.createdDate desc, f.id asc")
  List<ComplianceAssessmentFindingEntity> findOpenBlockingFor(
      @Param("challengeId") String challengeId,
      @Param("statuses") Collection<String> statuses);

  /**
   * Blocking findings mapped to one obligation gate, whatever their status.
   *
   * <p>A gate only looks at the findings that block <em>it</em>: entry_open
   * cares about open_entry findings, voting_open about open_voting. Widening
   * this would refuse to open entries over a finding that only concerns voting.
   */
  @Query("select f from ComplianceAssessmentFindingEntity f "
      + "where f.challengeId = :challengeId and f.blocking = true "
      + "and f.gate = :gate order by f.createdDate desc, f.id asc")
  List<ComplianceAssessmentFindingEntity> findBlockingForGate(
      @Param("challengeId") String challengeId, @Param("gate") String gate);

  /** Every blocking finding on a challenge, whatever gate it maps to. */
  @Query("select f from ComplianceAssessmentFindingEntity f "
      + "where f.challengeId = :challengeId and f.blocking = true "
      + "order by f.createdDate desc, f.id asc")
  List<ComplianceAssessmentFindingEntity> findAllBlocking(
      @Param("challengeId") String challengeId);

  /**
   * Permit findings previously marked satisfied.
   *
   * <p>Satisfied is not permanent: the permit behind it can expire or be
   * withdrawn. These are the rows that must be re-checked against their
   * evidence before any gate trusts them.
   */
  @Query("select f from ComplianceAssessmentFindingEntity f "
      + "where f.challengeId = :challengeId and f.obligationType = 'permit_required' "
      + "and f.status = 'satisfied' order by f.createdDate desc, f.id asc")
  List<ComplianceAssessmentFindingEntity> findSatisfiedPermitFindings(
      @Param("challengeId") String challengeId);

  /**
   * Findings of the given obligation types, whatever their status.
   *
   * <p>Used to re-open the ones that were only satisfied because a terms
   * document said so, when that document is superseded.
   */
  @Query("select f from ComplianceAssessmentFindingEntity f "
      + "where f.challengeId = :challengeId and f.obligationType in :obligationTypes "
      + "order by f.createdDate desc, f.id asc")
  List<ComplianceAssessmentFindingEntity> findByObligationTypes(
      @Param("challengeId") String challengeId,
      @Param("obligationTypes") Collection<String> obligationTypes);

  /** Permit findings in one jurisdiction, whatever their status. */
  @Query("select f from ComplianceAssessmentFindingEntity f "
      + "where f.challengeId = :challengeId and f.obligationType = 'permit_required' "
      + "and f.jurisdictionCode = :jurisdiction order by f.createdDate desc, f.id asc")
  List<ComplianceAssessmentFindingEntity> findPermitFindingsForJurisdiction(
      @Param("challengeId") String challengeId, @Param("jurisdiction") String jurisdiction);
}
