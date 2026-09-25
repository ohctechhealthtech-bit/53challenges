package com.fiftythree.challenges.compliance;

import com.fiftythree.challenges.entity.LaunchCompetitionEntity;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** The assembled structure behind a challenge: its mechanic, scoring model and audience. */
public interface LaunchCompetitionQueryRepository extends JpaRepository<LaunchCompetitionEntity, String> {

  @Query("select l from LaunchCompetitionEntity l where l.challengeId = :challengeId "
      + "order by l.createdDate desc, l.id asc")
  List<LaunchCompetitionEntity> findByChallengeId(@Param("challengeId") String challengeId);
}
