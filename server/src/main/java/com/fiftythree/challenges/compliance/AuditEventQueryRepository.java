package com.fiftythree.challenges.compliance;

import com.fiftythree.challenges.entity.ComplianceAuditEventEntity;
import java.util.List;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** The compliance audit trail, for the admin event log. */
public interface AuditEventQueryRepository
    extends JpaRepository<ComplianceAuditEventEntity, String> {

  @Query("select e from ComplianceAuditEventEntity e where e.challengeId = :challengeId "
      + "order by e.createdDate desc, e.id asc")
  List<ComplianceAuditEventEntity> findByChallenge(
      @Param("challengeId") String challengeId, Pageable pageable);

  @Query("select e from ComplianceAuditEventEntity e order by e.createdDate desc, e.id asc")
  List<ComplianceAuditEventEntity> findAllNewestFirst(Pageable pageable);
}
