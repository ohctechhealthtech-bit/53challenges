package com.fiftythree.challenges.compliance;

import com.fiftythree.challenges.entity.LegalPositionEntity;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** The firm's standing legal positions, which the classifier consults. */
public interface LegalPositionQueryRepository extends JpaRepository<LegalPositionEntity, String> {

  /**
   * The active position on one topic.
   *
   * <p>Only active ones: a superseded position stays in the table for the
   * record but must never decide a classification.
   */
  @Query("select p from LegalPositionEntity p where p.topic = :topic and p.isActive = true "
      + "order by p.createdDate desc, p.id asc")
  List<LegalPositionEntity> findActiveByTopic(@Param("topic") String topic);

  @Query("select p from LegalPositionEntity p order by p.createdDate desc, p.id asc")
  List<LegalPositionEntity> findAllNewestFirst();
}
