package com.fiftythree.challenges.compliance;

import com.fiftythree.challenges.entity.PermitActionEntity;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PermitActionQueryRepository extends JpaRepository<PermitActionEntity, String> {

  @Query("select a from PermitActionEntity a where a.status = 'pending' "
      + "order by a.createdDate desc, a.id asc")
  List<PermitActionEntity> findPending();

  @Query("select a from PermitActionEntity a where a.challengeId = :challengeId "
      + "order by a.createdDate desc, a.id asc")
  List<PermitActionEntity> findByChallenge(@Param("challengeId") String challengeId);

  @Query("select a from PermitActionEntity a order by a.createdDate desc, a.id asc")
  List<PermitActionEntity> findAllNewestFirst();

  /**
   * Regulator notifications that have not gone out yet.
   *
   * <p>Entries cannot open while one is outstanding: the regulator has to be
   * told before the competition runs, not after it has started taking entries.
   */
  @Query("select a from PermitActionEntity a where a.challengeId = :challengeId "
      + "and a.actionType = 'notify_regulator' and a.status in ('pending', 'overdue') "
      + "order by a.createdDate desc, a.id asc")
  List<PermitActionEntity> findPendingRegulatorNotifications(
      @Param("challengeId") String challengeId);

  /** An existing notification for one instrument and challenge, to avoid duplicates. */
  @Query("select a from PermitActionEntity a where a.instrumentId = :instrumentId "
      + "and a.challengeId = :challengeId and a.actionType = 'notify_regulator' "
      + "order by a.createdDate desc, a.id asc")
  List<PermitActionEntity> findNotification(
      @Param("instrumentId") String instrumentId, @Param("challengeId") String challengeId);
}
