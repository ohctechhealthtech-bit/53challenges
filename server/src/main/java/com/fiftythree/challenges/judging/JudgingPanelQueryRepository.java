package com.fiftythree.challenges.judging;

import com.fiftythree.challenges.entity.JudgingPanelEntity;
import java.util.List;
import org.springframework.data.domain.Limit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface JudgingPanelQueryRepository extends JpaRepository<JudgingPanelEntity, String> {

  default List<JudgingPanelEntity> findLatestFor(String competitionId) {
    return findByCompetition(competitionId, Limit.of(5));
  }

  @Query("select p from JudgingPanelEntity p where p.competitionId = :competitionId "
      + "order by p.createdDate desc, p.id asc")
  List<JudgingPanelEntity> findByCompetition(
      @Param("competitionId") String competitionId, Limit limit);
}
