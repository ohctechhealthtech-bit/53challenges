package com.fiftythree.challenges.compliance;

import com.fiftythree.challenges.entity.ObligationEvidenceEntity;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ObligationEvidenceQueryRepository
    extends JpaRepository<ObligationEvidenceEntity, String> {

  /** Evidence rows pointing at one stored record — used when a permit expires. */
  @Query("select e from ObligationEvidenceEntity e where e.fileRecord = :fileRecord "
      + "order by e.recordedAt desc, e.id asc")
  List<ObligationEvidenceEntity> findByFileRecord(@Param("fileRecord") String fileRecord);

  /** The evidence recorded against one finding, most recent first. */
  @Query("select e from ObligationEvidenceEntity e where e.findingId = :findingId "
      + "order by e.recordedAt desc, e.id asc")
  List<ObligationEvidenceEntity> findByFinding(@Param("findingId") String findingId);
}
