package com.fiftythree.challenges.admin;

import com.fiftythree.challenges.entity.ChallengeEntity;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/**
 * Challenges scoped to one host organisation.
 *
 * <p>Top-level rather than nested: a nested repository interface is not
 * picked up by Spring Data, which cost an outage earlier in this migration.
 */
public interface HostChallengeQueryRepository extends JpaRepository<ChallengeEntity, String> {

  /**
   * The host-managed challenge ids belonging to an organisation.
   *
   * <p>Scoped in the query. This was a findAll() filtered in Java, which
   * pulled every challenge on the platform into heap to answer a question
   * about one organisation's handful.
   */
  @Query("select c.id from ChallengeEntity c where c.hostOrganisationId = :organisationId "
      + "and c.contentType = 'host_managed' order by c.createdDate desc, c.id asc")
  List<String> findHostManagedIds(@Param("organisationId") String organisationId);
}
