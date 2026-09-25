package com.fiftythree.challenges.pathway;

import com.fiftythree.challenges.entity.SeriesStandingEntity;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** Season standings, recomputed from scratch each time rather than patched. */
public interface SeriesStandingQueryRepository
    extends JpaRepository<SeriesStandingEntity, String> {

  @Query("select s from SeriesStandingEntity s where s.pathwayId = :pathwayId "
      + "order by s.rank asc, s.id asc")
  List<SeriesStandingEntity> findByPathway(@Param("pathwayId") String pathwayId);
}
