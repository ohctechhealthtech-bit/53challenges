package com.fiftythree.challenges.compliance;

import com.fiftythree.challenges.entity.ChallengeRightsConfigurationEntity;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** What rights entrants grant, which drives both the terms and the assessment triggers. */
public interface RightsConfigurationQueryRepository extends JpaRepository<ChallengeRightsConfigurationEntity, String> {

  @Query("select r from ChallengeRightsConfigurationEntity r where r.challengeId = :challengeId "
      + "order by r.createdDate desc, r.id asc")
  List<ChallengeRightsConfigurationEntity> findByChallengeId(@Param("challengeId") String challengeId);
}
