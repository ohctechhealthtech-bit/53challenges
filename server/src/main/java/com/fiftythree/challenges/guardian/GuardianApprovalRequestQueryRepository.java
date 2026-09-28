package com.fiftythree.challenges.guardian;

import com.fiftythree.challenges.entity.GuardianApprovalRequestEntity;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface GuardianApprovalRequestQueryRepository
    extends JpaRepository<GuardianApprovalRequestEntity, String> {

  /**
   * One guardian's approval requests.
   *
   * <p>Scoped in the query rather than by filtering {@code findAll()} in Java.
   * The old shape loaded every request in the database into heap before
   * discarding all but one guardian's — a denial-of-service waiting on table
   * growth, and a filter that would expose every family's requests if it were
   * ever edited wrongly.
   */
  @Query("select r from GuardianApprovalRequestEntity r "
      + "where lower(r.guardianEmail) = :email order by r.createdDate desc, r.id asc")
  List<GuardianApprovalRequestEntity> findByGuardianEmail(@Param("email") String email);
}
