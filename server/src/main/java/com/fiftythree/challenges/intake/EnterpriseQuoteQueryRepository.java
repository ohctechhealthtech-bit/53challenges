package com.fiftythree.challenges.intake;

import com.fiftythree.challenges.entity.EnterpriseQuoteEntity;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** Enterprise quotes attached to an intake draft. */
public interface EnterpriseQuoteQueryRepository extends JpaRepository<EnterpriseQuoteEntity, String> {

  @Query("select q from EnterpriseQuoteEntity q where q.draftId = :draftId "
      + "order by q.createdDate desc, q.id asc")
  List<EnterpriseQuoteEntity> findByDraft(@Param("draftId") String draftId);
}
