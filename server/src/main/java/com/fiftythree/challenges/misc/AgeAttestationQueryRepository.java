package com.fiftythree.challenges.misc;

import com.fiftythree.challenges.entity.AgeAttestationEntity;
import java.util.List;
import org.springframework.data.domain.Limit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface AgeAttestationQueryRepository extends JpaRepository<AgeAttestationEntity, String> {

  /**
   * The most recent attestation for an address.
   *
   * <p>Attestations are appended, never updated, so someone who was blocked as
   * under-age and later returns has more than one row. Only the newest decides
   * their current standing.
   */
  default List<AgeAttestationEntity> findLatestByEmail(String email) {
    return findByEmailOrderByCreatedDateDescIdAsc(email, Limit.of(1));
  }

  @Query("select a from AgeAttestationEntity a where lower(a.email) = :email "
      + "order by a.createdDate desc, a.id asc")
  List<AgeAttestationEntity> findByEmailOrderByCreatedDateDescIdAsc(
      @Param("email") String email, Limit limit);
}
