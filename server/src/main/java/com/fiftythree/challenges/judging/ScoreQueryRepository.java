package com.fiftythree.challenges.judging;

import com.fiftythree.challenges.entity.ScoreEntity;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/**
 * Hand-written score queries, kept out of the generated repository in
 * {@code entity}, which is rewritten on every regeneration.
 *
 * <p>A top-level interface, not one nested in a holder class: Spring Data's
 * scanning is straightforward about top-level types and this is not the place
 * to be clever about file count.
 */
public interface ScoreQueryRepository extends JpaRepository<ScoreEntity, String> {

  /**
   * Scores for a panel that actually count toward a result.
   *
   * <p>Only submitted and locked scores qualify. A draft is a judge's work in
   * progress, and counting one would publish an unfinished opinion as a final
   * mark.
   */
  @Query("select s from ScoreEntity s where s.panelId = :panelId "
      + "and s.status in ('submitted', 'locked')")
  List<ScoreEntity> findCountable(@Param("panelId") String panelId);
/** Every score by one judge, newest first. */
  @Query("select s from ScoreEntity s where s.judgeProfileId = :judgeId "
      + "order by s.createdDate desc, s.id asc")
  List<ScoreEntity> findByJudge(@Param("judgeId") String judgeId);

  /** A judge's own score for one entry on one panel. */
  @Query("select s from ScoreEntity s where s.panelId = :panelId "
      + "and s.entryId = :entryId and s.judgeProfileId = :judgeId "
      + "order by s.createdDate desc, s.id asc")
  List<ScoreEntity> findOwn(
      @Param("panelId") String panelId,
      @Param("entryId") String entryId,
      @Param("judgeId") String judgeId);
}
