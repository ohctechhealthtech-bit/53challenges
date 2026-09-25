package com.fiftythree.challenges.admin;

import com.fiftythree.challenges.entity.ComplianceAssessmentFindingEntity;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface FindingRepo extends JpaRepository<ComplianceAssessmentFindingEntity, String> {

  /**
   * Open findings that block. Non-blocking ones are advisory and do not stop a
   * challenge, so they do not belong in a queue titled "blocked".
   */
  @Query("select f from ComplianceAssessmentFindingEntity f where f.status = 'open' "
      + "and f.blocking = true order by f.createdDate desc, f.id asc")
  List<ComplianceAssessmentFindingEntity> findOpenBlocking();
}
