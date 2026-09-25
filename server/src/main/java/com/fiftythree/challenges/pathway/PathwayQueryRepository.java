package com.fiftythree.challenges.pathway;

import com.fiftythree.challenges.entity.PathwayEntity;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

/** Competition pathways: series, qualifiers and the private or invited ones. */
public interface PathwayQueryRepository extends JpaRepository<PathwayEntity, String> {

  @Query("select p from PathwayEntity p order by p.createdDate desc, p.id asc")
  List<PathwayEntity> findAllNewestFirst();
}
