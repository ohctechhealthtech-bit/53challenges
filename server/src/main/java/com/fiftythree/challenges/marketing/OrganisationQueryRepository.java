package com.fiftythree.challenges.marketing;

import com.fiftythree.challenges.entity.OrganisationEntity;
import java.util.List;
import org.springframework.data.domain.Limit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** Schools, clubs and workplaces that bring groups of entrants. */
public interface OrganisationQueryRepository extends JpaRepository<OrganisationEntity, String> {

  @Query("select o from OrganisationEntity o where o.status = 'active' "
      + "order by o.createdDate desc, o.id asc")
  List<OrganisationEntity> findActive(Limit limit);
}
