package com.fiftythree.challenges.rights;

import com.fiftythree.challenges.entity.MarketingUseLogEntity;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** Every marketing use of an entry, and the scopes it relied on. */
public interface MarketingUseLogQueryRepository extends JpaRepository<MarketingUseLogEntity, String> {

  @Query("select l from MarketingUseLogEntity l where l.challengeId = :challengeId "
      + "order by l.usedAt desc, l.id asc")
  List<MarketingUseLogEntity> findByChallenge(@Param("challengeId") String challengeId);

  @Query("select l from MarketingUseLogEntity l where l.entryId = :entryId "
      + "order by l.usedAt desc, l.id asc")
  List<MarketingUseLogEntity> findByEntry(@Param("entryId") String entryId);

  @Query("select l from MarketingUseLogEntity l where l.challengeId = :challengeId "
      + "and l.entryId = :entryId order by l.usedAt desc, l.id asc")
  List<MarketingUseLogEntity> findByChallengeAndEntry(
      @Param("challengeId") String challengeId, @Param("entryId") String entryId);

  @Query("select l from MarketingUseLogEntity l order by l.usedAt desc, l.id asc")
  List<MarketingUseLogEntity> findAllNewestFirst();

  /**
   * Uses that have not been taken down. A revoked scope turns the matching
   * ones into takedown tasks, so these are the rows a revocation acts on.
   */
  @Query("select l from MarketingUseLogEntity l where l.entryId = :entryId "
      + "and l.takedownStatus = 'not_required' order by l.usedAt desc, l.id asc")
  List<MarketingUseLogEntity> findLiveUses(@Param("entryId") String entryId);
}
