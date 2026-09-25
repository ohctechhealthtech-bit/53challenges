package com.fiftythree.challenges.terms;

import com.fiftythree.challenges.entity.ApprovedClauseEntity;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** The lawyer-approved clause library the terms assembler draws from. */
public interface ApprovedClauseQueryRepository extends JpaRepository<ApprovedClauseEntity, String> {

  /**
   * The current clause library. Superseded versions stay in the table for the
   * audit trail but must never be assembled into a new document.
   */
  @Query("select c from ApprovedClauseEntity c where c.isCurrent = true "
      + "order by c.createdDate desc, c.id asc")
  List<ApprovedClauseEntity> findCurrent();

  /** One identifier's current clause, used to reject a duplicate on create. */
  @Query("select c from ApprovedClauseEntity c where c.identifier = :identifier "
      + "and c.isCurrent = true order by c.createdDate desc, c.id asc")
  List<ApprovedClauseEntity> findCurrentByIdentifier(@Param("identifier") String identifier);
}
