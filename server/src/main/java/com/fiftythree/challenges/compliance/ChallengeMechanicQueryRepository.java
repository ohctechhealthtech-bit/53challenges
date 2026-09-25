package com.fiftythree.challenges.compliance;

import com.fiftythree.challenges.entity.ChallengeMechanicEntity;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** Mechanics are referenced by slug, not id, throughout the launch records. */
public interface ChallengeMechanicQueryRepository extends JpaRepository<ChallengeMechanicEntity, String> {

  @Query("select m from ChallengeMechanicEntity m where m.slug = :slug "
      + "order by m.createdDate desc, m.id asc")
  List<ChallengeMechanicEntity> findBySlug(@Param("slug") String slug);
}
