package com.fiftythree.challenges.compliance;

import com.fiftythree.challenges.entity.RegulatoryRuleEntity;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** The regulatory rule catalogue, keyed by code rather than by id. */
public interface RegulatoryRuleQueryRepository extends JpaRepository<RegulatoryRuleEntity, String> {

  @Query("select r from RegulatoryRuleEntity r order by r.createdDate desc, r.id asc")
  List<RegulatoryRuleEntity> findAllNewestFirst();

  @Query("select r from RegulatoryRuleEntity r where r.code = :code "
      + "order by r.createdDate desc, r.id asc")
  List<RegulatoryRuleEntity> findByCode(@Param("code") String code);
}
