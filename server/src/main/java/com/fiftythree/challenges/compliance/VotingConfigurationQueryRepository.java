package com.fiftythree.challenges.compliance;

import com.fiftythree.challenges.entity.VotingConfigurationEntity;
import java.util.List;
import org.springframework.data.domain.Limit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface VotingConfigurationQueryRepository
    extends JpaRepository<VotingConfigurationEntity, String> {

  default List<VotingConfigurationEntity> findLatestFor(String challengeId) {
    return findByChallenge(challengeId, Limit.of(1));
  }

  @Query("select v from VotingConfigurationEntity v where v.challengeId = :challengeId "
      + "order by v.createdDate desc, v.id asc")
  List<VotingConfigurationEntity> findByChallenge(
      @Param("challengeId") String challengeId, Limit limit);
}
