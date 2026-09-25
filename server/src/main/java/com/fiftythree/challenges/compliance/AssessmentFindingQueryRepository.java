package com.fiftythree.challenges.compliance;

import com.fiftythree.challenges.entity.ComplianceAssessmentFindingEntity;
import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/**
 * Finding reads for the assessment screen. Kept apart from
 * {@link FindingQueryRepository}, which serves the gate checks and asks
 * narrower, enforcement-shaped questions.
 */
public interface AssessmentFindingQueryRepository
    extends JpaRepository<ComplianceAssessmentFindingEntity, String> {

  @Query("select f from ComplianceAssessmentFindingEntity f "
      + "where f.assessmentId = :assessmentId order by f.createdDate desc, f.id asc")
  List<ComplianceAssessmentFindingEntity> findByAssessment(
      @Param("assessmentId") String assessmentId);

  @Query("select f from ComplianceAssessmentFindingEntity f "
      + "where f.challengeId = :challengeId order by f.createdDate desc, f.id asc")
  List<ComplianceAssessmentFindingEntity> findByChallenge(
      @Param("challengeId") String challengeId);

  @Query("select f from ComplianceAssessmentFindingEntity f "
      + "order by f.createdDate desc, f.id asc")
  List<ComplianceAssessmentFindingEntity> findAllNewestFirst();

  /** Findings still needing work, which a re-assessment must not duplicate. */
  @Query("select f from ComplianceAssessmentFindingEntity f "
      + "where f.challengeId = :challengeId and f.status in :statuses "
      + "order by f.createdDate desc, f.id asc")
  List<ComplianceAssessmentFindingEntity> findByStatuses(
      @Param("challengeId") String challengeId,
      @Param("statuses") Collection<String> statuses);

  /** Open permit findings in one jurisdiction, for the post-assessment checks. */
  @Query("select f from ComplianceAssessmentFindingEntity f "
      + "where f.challengeId = :challengeId and f.obligationType = 'permit_required' "
      + "and f.jurisdictionCode = :jurisdiction order by f.createdDate desc, f.id asc")
  List<ComplianceAssessmentFindingEntity> findPermitFindings(
      @Param("challengeId") String challengeId, @Param("jurisdiction") String jurisdiction);
}
