package com.fiftythree.challenges.guardian;

import com.fiftythree.challenges.entity.GuardianChildEntity;
import java.util.List;
import org.springframework.data.domain.Limit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface GuardianChildQueryRepository extends JpaRepository<GuardianChildEntity, String> {

  default List<GuardianChildEntity> findLink(String guardianId, String childEmail) {
    return findByGuardianAndChild(guardianId, childEmail, Limit.of(1));
  }

  @Query("select c from GuardianChildEntity c where c.guardianId = :guardianId "
      + "and lower(c.childEmail) = :childEmail order by c.createdDate desc, c.id asc")
  List<GuardianChildEntity> findByGuardianAndChild(
      @Param("guardianId") String guardianId,
      @Param("childEmail") String childEmail,
      Limit limit);

  /**
   * One guardian's child links, scoped in the query.
   *
   * <p>Replaces a {@code findAll()} that pulled every link in the database
   * into heap before filtering to one guardian in Java.
   */
  @Query("select c from GuardianChildEntity c where c.guardianId = :guardianId "
      + "order by c.createdDate desc, c.id asc")
  List<GuardianChildEntity> findByGuardian(@Param("guardianId") String guardianId);
}
