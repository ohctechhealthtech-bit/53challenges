package com.fiftythree.challenges.prize;

import com.fiftythree.challenges.entity.PrizePayoutEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PrizePayoutQueryRepository extends JpaRepository<PrizePayoutEntity, String> {

  /**
   * Clears a ledger's payouts before regenerating.
   *
   * <p>Regenerating must replace, not append: two generations of payout rows
   * for one ledger would mean paying a winner twice.
   */
  @Modifying
  @Query("delete from PrizePayoutEntity p where p.ledgerId = :ledgerId")
  void deleteByLedgerId(@Param("ledgerId") String ledgerId);
}
