package com.fiftythree.challenges.prize;

import com.fiftythree.challenges.entity.CombinedResultEntity;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface CombinedResultQueryRepo extends JpaRepository<CombinedResultEntity, String> {

  /** Results in finishing order — position 1 first. */
  @Query("select r from CombinedResultEntity r where r.challengeId = :challengeId "
      + "order by r.combinedRank asc, r.id asc")
  List<CombinedResultEntity> findByChallengeRanked(@Param("challengeId") String challengeId);
}
