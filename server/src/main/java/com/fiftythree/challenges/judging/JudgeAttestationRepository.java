package com.fiftythree.challenges.judging;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/**
 * Conflict-of-interest declarations, scoped to one judge.
 *
 * <p>Top-level rather than nested: Spring Data does not register a nested
 * repository interface, which cost an outage during the migration.
 */
public interface JudgeAttestationRepository extends JpaRepository<JudgeAttestationEntity, String> {

  /** Every category this judge has declared for. */
  @Query("select a from JudgeAttestationEntity a where lower(a.judgeEmail) = :email "
      + "order by a.attestedAt desc, a.id asc")
  List<JudgeAttestationEntity> findByJudge(@Param("email") String email);
}
