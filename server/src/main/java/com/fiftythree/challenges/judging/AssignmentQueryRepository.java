package com.fiftythree.challenges.judging;

import com.fiftythree.challenges.entity.EntryJudgeAssignmentEntity;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface AssignmentQueryRepository
    extends JpaRepository<EntryJudgeAssignmentEntity, String> {

  @Query("select a from EntryJudgeAssignmentEntity a where a.judgeProfileId = :judgeId "
      + "order by a.assignedAt desc, a.id asc")
  List<EntryJudgeAssignmentEntity> findByJudge(@Param("judgeId") String judgeId);

  /**
   * The allocation authorising one judge to score one entry.
   *
   * <p>All three parts are required: panel membership alone does not authorise
   * scoring an entry that was deliberately allocated elsewhere.
   */
  @Query("select a from EntryJudgeAssignmentEntity a where a.panelId = :panelId "
      + "and a.entryId = :entryId and a.judgeProfileId = :judgeId "
      + "order by a.assignedAt desc, a.id asc")
  List<EntryJudgeAssignmentEntity> findAllocation(
      @Param("panelId") String panelId,
      @Param("entryId") String entryId,
      @Param("judgeId") String judgeId);
/** Every allocation on a panel, for verifying conflict exclusions. */
  @Query("select a from EntryJudgeAssignmentEntity a where a.panelId = :panelId")
  List<EntryJudgeAssignmentEntity> findByPanel(@Param("panelId") String panelId);
}
