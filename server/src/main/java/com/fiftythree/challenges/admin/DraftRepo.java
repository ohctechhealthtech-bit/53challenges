package com.fiftythree.challenges.admin;

import com.fiftythree.challenges.entity.ChallengeDraftEntity;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface DraftRepo extends JpaRepository<ChallengeDraftEntity, String> {
  @Query("select d from ChallengeDraftEntity d where d.reviewStatus = :status "
      + "order by d.createdDate desc, d.id asc")
  List<ChallengeDraftEntity> findByReviewStatus(@Param("status") String status);

  /** Host applications for one host, used to resolve their review rights. */
  @Query("select d from ChallengeDraftEntity d where d.origin = 'host_apply' "
      + "order by d.createdDate desc, d.id asc")
  List<ChallengeDraftEntity> findHostApplications();
}
