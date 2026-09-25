package com.fiftythree.challenges.prize;

import com.fiftythree.challenges.entity.AuditReviewEntity;
import java.util.List;
import org.springframework.data.domain.Limit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface AuditReviewQueryRepository extends JpaRepository<AuditReviewEntity, String> {

  default List<AuditReviewEntity> findLatestFor(String competitionId) {
    return findByCompetition(competitionId, Limit.of(5));
  }

  @Query("select a from AuditReviewEntity a where a.competitionId = :competitionId "
      + "order by a.createdDate desc, a.id asc")
  List<AuditReviewEntity> findByCompetition(
      @Param("competitionId") String competitionId, Limit limit);
}
