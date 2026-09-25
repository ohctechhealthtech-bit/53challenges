package com.fiftythree.challenges.intake;

import com.fiftythree.challenges.entity.DeliverableEntity;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

/** The deliverable catalogue a producer works through. */
public interface DeliverableQueryRepository extends JpaRepository<DeliverableEntity, String> {

  @Query("select r from DeliverableEntity r order by r.sortOrder asc, r.id asc")
  List<DeliverableEntity> findInOrder();
}
