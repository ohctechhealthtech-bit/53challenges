package com.fiftythree.challenges.judging;

import com.fiftythree.challenges.entity.CombinedResultEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface CombinedResultQueryRepository
    extends JpaRepository<CombinedResultEntity, String> {

  /**
   * Clears a challenge's previous results.
   *
   * <p>Recomputing replaces rather than accumulates: without this a second run
   * leaves two generations of results in the table and the published rankings
   * are read from a mixture of both.
   */
  @Modifying
  @Query("delete from CombinedResultEntity r where r.challengeId = :challengeId")
  void deleteByChallengeId(@Param("challengeId") String challengeId);

  /**
   * A challenge's final placings, best first.
   *
   * <p>Ordered by rank rather than by score: the rank is what the judging
   * process settled on, including any tie-break, and re-deriving an order from
   * the raw score could disagree with the result that was published.
   */
  @Query("select r from CombinedResultEntity r where r.challengeId = :challengeId "
      + "and r.combinedRank > 0 order by r.combinedRank asc, r.id asc")
  java.util.List<CombinedResultEntity> findRanked(@Param("challengeId") String challengeId);
}
