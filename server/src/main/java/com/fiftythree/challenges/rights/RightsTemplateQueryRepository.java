package com.fiftythree.challenges.rights;

import com.fiftythree.challenges.entity.RightsGrantTemplateEntity;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** The scope library participants grant from: one template per rights scope. */
public interface RightsTemplateQueryRepository extends JpaRepository<RightsGrantTemplateEntity, String> {

  /**
   * The current templates, in the order the consent screen shows them.
   * Superseded versions stay for the record but are never offered.
   */
  @Query("select t from RightsGrantTemplateEntity t where t.isCurrent = true "
      + "order by t.sortOrder asc, t.id asc")
  List<RightsGrantTemplateEntity> findCurrent();
}
