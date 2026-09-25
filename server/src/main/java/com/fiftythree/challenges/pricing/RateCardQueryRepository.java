package com.fiftythree.challenges.pricing;

import com.fiftythree.challenges.entity.RateCardEntity;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface RateCardQueryRepository extends JpaRepository<RateCardEntity, String> {

  /**
   * The live rate card, highest version first.
   *
   * <p>Returns a list rather than one row: if more than one card is somehow
   * marked active, the caller deactivates them all rather than silently
   * pricing against whichever happened to be picked.
   */
  @Query("select r from RateCardEntity r where r.isActive = true "
      + "order by r.version desc, r.id asc")
  List<RateCardEntity> findActive();

  @Query("select r from RateCardEntity r order by r.version desc, r.id asc")
  List<RateCardEntity> findAllNewestVersionFirst();
}
