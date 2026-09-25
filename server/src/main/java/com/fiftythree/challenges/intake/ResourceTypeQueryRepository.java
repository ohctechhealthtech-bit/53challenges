package com.fiftythree.challenges.intake;

import com.fiftythree.challenges.entity.ResourceTypeEntity;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

/** Billable resource types and their standard rates. */
public interface ResourceTypeQueryRepository extends JpaRepository<ResourceTypeEntity, String> {

  @Query("select r from ResourceTypeEntity r order by r.sortOrder asc, r.id asc")
  List<ResourceTypeEntity> findInOrder();
}
