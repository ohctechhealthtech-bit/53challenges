package com.fiftythree.challenges.compliance;

import com.fiftythree.challenges.entity.RegulatoryRuleVersionEntity;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** Versions of the regulatory rules. Only signed, current ones are evaluated. */
public interface RuleVersionQueryRepository
    extends JpaRepository<RegulatoryRuleVersionEntity, String> {

  @Query("select v from RegulatoryRuleVersionEntity v where v.isCurrent = true "
      + "order by v.createdDate desc, v.id asc")
  List<RegulatoryRuleVersionEntity> findCurrent();

  /** Every version of one rule, highest version number first. */
  @Query("select v from RegulatoryRuleVersionEntity v where v.ruleCode = :ruleCode "
      + "order by v.versionNumber desc, v.id asc")
  List<RegulatoryRuleVersionEntity> findByRuleCode(@Param("ruleCode") String ruleCode);

  /** The versions a new one supersedes. */
  @Query("select v from RegulatoryRuleVersionEntity v where v.ruleCode = :ruleCode "
      + "and v.isCurrent = true order by v.createdDate desc, v.id asc")
  List<RegulatoryRuleVersionEntity> findCurrentByRuleCode(@Param("ruleCode") String ruleCode);
}
