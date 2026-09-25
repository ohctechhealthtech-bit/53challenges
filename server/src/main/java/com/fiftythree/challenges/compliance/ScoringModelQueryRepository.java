package com.fiftythree.challenges.compliance;

import com.fiftythree.challenges.entity.ScoringModelEntity;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** Scoring models carry the judge and public weights the terms clauses key off. */
public interface ScoringModelQueryRepository extends JpaRepository<ScoringModelEntity, String> {

  @Query("select s from ScoringModelEntity s where s.slug = :slug "
      + "order by s.createdDate desc, s.id asc")
  List<ScoringModelEntity> findBySlug(@Param("slug") String slug);
}
