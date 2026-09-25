package com.fiftythree.challenges.compliance;

import com.fiftythree.challenges.entity.ParticipationModeEntity;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** Participation modes: individual, team, school class and the rest. */
public interface ParticipationModeQueryRepository extends JpaRepository<ParticipationModeEntity, String> {

  @Query("select p from ParticipationModeEntity p where p.slug = :slug "
      + "order by p.createdDate desc, p.id asc")
  List<ParticipationModeEntity> findBySlug(@Param("slug") String slug);
}
