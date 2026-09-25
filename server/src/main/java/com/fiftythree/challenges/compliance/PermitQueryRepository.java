package com.fiftythree.challenges.compliance;

import com.fiftythree.challenges.entity.PermitOrAuthorityEntity;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PermitQueryRepository extends JpaRepository<PermitOrAuthorityEntity, String> {

  /** Instruments in a status where they could still be valid. */
  @Query("select p from PermitOrAuthorityEntity p where p.status in ('active', 'issued') "
      + "order by p.createdDate desc, p.id asc")
  List<PermitOrAuthorityEntity> findUsable();

  @Query("select p from PermitOrAuthorityEntity p order by p.createdDate desc, p.id asc")
  List<PermitOrAuthorityEntity> findAllNewestFirst();

  /**
   * Multi-year authorities in one jurisdiction that are capable of covering a
   * competition without a per-competition permit.
   */
  @Query("select p from PermitOrAuthorityEntity p where p.jurisdictionCode = :jurisdiction "
      + "and p.instrumentType = 'authority_multiyear' and p.status in ('active', 'issued') "
      + "order by p.createdDate desc, p.id asc")
  List<PermitOrAuthorityEntity> findMultiYearAuthorities(@Param("jurisdiction") String jurisdiction);
}
