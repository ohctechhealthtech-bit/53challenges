package com.fiftythree.challenges.lifecycle;

import com.fiftythree.challenges.entity.LifecycleGateEntity;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

/** The gate reference data: one row per stage gate, in lifecycle order. */
public interface LifecycleGateQueryRepository extends JpaRepository<LifecycleGateEntity, String> {

  /**
   * Gate definitions in the order the admin screen shows them. Ordered by
   * {@code sortOrder} rather than by code, because the codes are not
   * alphabetical and the sequence is the whole point of a stage gate.
   */
  @Query("select g from LifecycleGateEntity g order by g.sortOrder asc, g.id asc")
  List<LifecycleGateEntity> findAllInOrder();
}
