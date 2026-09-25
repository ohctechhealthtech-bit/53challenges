package com.fiftythree.challenges.judging;

import com.fiftythree.challenges.entity.CompetitionAssignmentEntity;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface CompetitionAssignmentQueryRepository
    extends JpaRepository<CompetitionAssignmentEntity, String> {

  /**
   * One person's active roles on a competition.
   *
   * <p>Used for the role-separation check: an auditor must not also hold a
   * judge or manager role here.
   */
  @Query("select a from CompetitionAssignmentEntity a where a.competitionId = :competitionId "
      + "and lower(a.judgeEmail) = :email and a.status = 'active'")
  List<CompetitionAssignmentEntity> findActiveFor(
      @Param("competitionId") String competitionId, @Param("email") String email);
}
