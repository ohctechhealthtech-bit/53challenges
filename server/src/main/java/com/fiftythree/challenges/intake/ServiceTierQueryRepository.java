package com.fiftythree.challenges.intake;

import com.fiftythree.challenges.entity.ServiceTierEntity;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

/** Service tiers, each carrying the deliverables it includes. */
public interface ServiceTierQueryRepository extends JpaRepository<ServiceTierEntity, String> {

  @Query("select r from ServiceTierEntity r order by r.sortOrder asc, r.id asc")
  List<ServiceTierEntity> findInOrder();
}
