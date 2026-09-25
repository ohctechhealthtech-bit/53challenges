package com.fiftythree.challenges.compliance;

import com.fiftythree.challenges.entity.ComplianceGateLogEntity;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ComplianceGateLogQueryRepository
    extends JpaRepository<ComplianceGateLogEntity, String> {

  @Query("select l from ComplianceGateLogEntity l where l.gateId = :gateId "
      + "order by l.createdDate desc, l.id asc")
  List<ComplianceGateLogEntity> findByGate(@Param("gateId") String gateId);
}
