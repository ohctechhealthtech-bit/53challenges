package com.fiftythree.challenges.lifecycle;

import com.fiftythree.challenges.entity.ChallengeComplianceAssessmentEntity;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** Compliance assessments, used to prove one has been run at all. */
public interface AssessmentQueryRepository
    extends JpaRepository<ChallengeComplianceAssessmentEntity, String> {

  /**
   * Assessments for one challenge, most recently assessed first. The gate only
   * needs to know whether the list is empty — a challenge that has never been
   * assessed cannot be approved — but the order matters to callers that want
   * the latest classification.
   */
  @Query("select a from ChallengeComplianceAssessmentEntity a "
      + "where a.challengeId = :challengeId order by a.assessedAt desc, a.id asc")
  List<ChallengeComplianceAssessmentEntity> findByChallenge(
      @Param("challengeId") String challengeId);
}
