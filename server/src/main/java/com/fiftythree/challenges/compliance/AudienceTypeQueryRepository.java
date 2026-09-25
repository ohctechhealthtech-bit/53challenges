package com.fiftythree.challenges.compliance;

import com.fiftythree.challenges.entity.AudienceTypeEntity;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** Audience types decide whether the minors clauses are required. */
public interface AudienceTypeQueryRepository extends JpaRepository<AudienceTypeEntity, String> {

  @Query("select a from AudienceTypeEntity a where a.slug = :slug "
      + "order by a.createdDate desc, a.id asc")
  List<AudienceTypeEntity> findBySlug(@Param("slug") String slug);
}
