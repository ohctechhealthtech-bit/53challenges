package com.fiftythree.challenges.compliance;

import com.fiftythree.challenges.entity.ComplianceTriggerEntity;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

/** The detection triggers that classify a challenge. */
public interface ComplianceTriggerQueryRepository
    extends JpaRepository<ComplianceTriggerEntity, String> {

  /**
   * Triggers in evaluation order. The order is stored, not incidental: the
   * classifier reads the fired list positionally in places, and a trigger
   * evaluated out of sequence changes which rules attach.
   */
  @Query("select t from ComplianceTriggerEntity t order by t.sortOrder asc, t.id asc")
  List<ComplianceTriggerEntity> findInOrder();
}
