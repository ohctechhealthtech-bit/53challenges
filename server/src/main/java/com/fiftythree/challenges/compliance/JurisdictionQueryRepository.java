package com.fiftythree.challenges.compliance;

import com.fiftythree.challenges.entity.JurisdictionEntity;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

/** The jurisdictions rules are written against. */
public interface JurisdictionQueryRepository extends JpaRepository<JurisdictionEntity, String> {

  @Query("select j from JurisdictionEntity j order by j.createdDate desc, j.id asc")
  List<JurisdictionEntity> findAllNewestFirst();
}
