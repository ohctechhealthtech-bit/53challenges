package com.fiftythree.challenges.judging;

import com.fiftythree.challenges.entity.AuditFindingEntity;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface AuditFindingQueryRepository extends JpaRepository<AuditFindingEntity, String> {

  @Query("select f from AuditFindingEntity f where f.reviewId = :reviewId "
      + "and f.status = 'open' order by f.createdDate desc, f.id asc")
  List<AuditFindingEntity> findOpenFor(@Param("reviewId") String reviewId);
}
