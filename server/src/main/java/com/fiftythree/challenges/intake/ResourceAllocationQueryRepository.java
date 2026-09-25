package com.fiftythree.challenges.intake;

import com.fiftythree.challenges.entity.ResourceAllocationEntity;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** The resourcing lines behind a quote. */
public interface ResourceAllocationQueryRepository extends JpaRepository<ResourceAllocationEntity, String> {

  @Query("select a from ResourceAllocationEntity a where a.draftId = :draftId "
      + "order by a.createdDate asc, a.id asc")
  List<ResourceAllocationEntity> findByDraft(@Param("draftId") String draftId);
}
