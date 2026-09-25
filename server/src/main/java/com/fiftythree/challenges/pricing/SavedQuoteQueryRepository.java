package com.fiftythree.challenges.pricing;

import com.fiftythree.challenges.entity.SavedQuoteEntity;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface SavedQuoteQueryRepository extends JpaRepository<SavedQuoteEntity, String> {

  /** The most recent quote linked to an intake response. */
  @Query("select q from SavedQuoteEntity q where q.intakeResponseId = :intakeResponseId "
      + "order by q.createdDate desc, q.id asc")
  List<SavedQuoteEntity> findForIntake(@Param("intakeResponseId") String intakeResponseId);
}
