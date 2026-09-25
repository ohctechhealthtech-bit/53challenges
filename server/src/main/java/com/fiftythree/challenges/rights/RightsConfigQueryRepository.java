package com.fiftythree.challenges.rights;

import com.fiftythree.challenges.entity.ChallengeRightsConfigurationEntity;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** All rights configurations, for the admin list. */
public interface RightsConfigQueryRepository extends JpaRepository<ChallengeRightsConfigurationEntity, String> {

  @Query("select c from ChallengeRightsConfigurationEntity c "
      + "order by c.createdDate desc, c.id asc")
  List<ChallengeRightsConfigurationEntity> findAllNewestFirst();
}
