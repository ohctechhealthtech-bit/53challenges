package com.fiftythree.challenges.lifecycle;

import com.fiftythree.challenges.entity.GateCheckEntity;
import java.util.List;
import org.springframework.data.domain.Limit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface GateCheckQueryRepository extends JpaRepository<GateCheckEntity, String> {

  /** The newest check for one gate on one challenge. */
  default List<GateCheckEntity> findLatest(String challengeId, String gateCode) {
    return findByChallengeAndGate(challengeId, gateCode, Limit.of(1));
  }

  @Query("select g from GateCheckEntity g where g.challengeId = :challengeId "
      + "and g.gateCode = :gateCode order by g.createdDate desc, g.id asc")
  List<GateCheckEntity> findByChallengeAndGate(
      @Param("challengeId") String challengeId,
      @Param("gateCode") String gateCode,
      Limit limit);

  /**
   * Whether this challenge has any gate check at all — one row is enough, so
   * the query is limited rather than counting every row.
   */
  default List<GateCheckEntity> findAnyFor(String challengeId) {
    return findByChallenge(challengeId, Limit.of(1));
  }

  @Query("select g from GateCheckEntity g where g.challengeId = :challengeId "
      + "order by g.createdDate desc, g.id asc")
  List<GateCheckEntity> findByChallenge(
      @Param("challengeId") String challengeId, Limit limit);
}
