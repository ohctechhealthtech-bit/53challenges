package com.fiftythree.challenges.lifecycle;

import com.fiftythree.challenges.entity.ComplianceGateEntity;
import java.util.List;
import org.springframework.data.domain.Limit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ComplianceGateQueryRepository extends JpaRepository<ComplianceGateEntity, String> {

  /** The newest compliance gate record for a challenge. */
  default List<ComplianceGateEntity> findLatestFor(String challengeId) {
    return findByChallenge(challengeId, Limit.of(1));
  }

  @Query("select c from ComplianceGateEntity c where c.challengeId = :challengeId "
      + "order by c.createdDate desc, c.id asc")
  List<ComplianceGateEntity> findByChallenge(
      @Param("challengeId") String challengeId, Limit limit);
/** Gates for a set of challenges in one query, newest first. */
  @Query("select c from ComplianceGateEntity c where c.challengeId in :challengeIds "
      + "order by c.createdDate desc, c.id asc")
  List<ComplianceGateEntity> findByChallengeIds(
      @Param("challengeIds") java.util.Collection<String> challengeIds);
}
