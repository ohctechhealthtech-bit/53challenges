package com.fiftythree.challenges.pathway;

import com.fiftythree.challenges.entity.PromotionEntity;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** The record of who was promoted from one challenge into the next. */
public interface PromotionQueryRepository extends JpaRepository<PromotionEntity, String> {

  @Query("select p from PromotionEntity p where p.pathwayId = :pathwayId")
  List<PromotionEntity> findByPathway(@Param("pathwayId") String pathwayId);

  /**
   * An existing promotion of one source entry. This is what makes
   * {@code promote_winners} safe to run twice — without it, a second run
   * creates duplicate entries in the target challenge.
   */
  @Query("select p from PromotionEntity p where p.fromChallengeId = :fromChallengeId "
      + "and p.sourceEntryId = :sourceEntryId order by p.createdDate desc, p.id asc")
  List<PromotionEntity> findForSourceEntry(
      @Param("fromChallengeId") String fromChallengeId,
      @Param("sourceEntryId") String sourceEntryId);
}
