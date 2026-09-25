package com.fiftythree.challenges.intake;

import com.fiftythree.challenges.entity.IntakeAnswerOptionEntity;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** The answer options, which carry the taxonomy weights. */
public interface AnswerOptionQueryRepository extends JpaRepository<IntakeAnswerOptionEntity, String> {

  @Query("select o from IntakeAnswerOptionEntity o where o.questionId = :questionId "
      + "order by o.sortOrder asc, o.id asc")
  List<IntakeAnswerOptionEntity> findByQuestion(@Param("questionId") String questionId);

  @Query("select o from IntakeAnswerOptionEntity o where o.questionId in :questionIds "
      + "order by o.sortOrder asc, o.id asc")
  List<IntakeAnswerOptionEntity> findByQuestions(
      @Param("questionIds") java.util.Collection<String> questionIds);

  @Query("select o from IntakeAnswerOptionEntity o where o.id in :ids")
  List<IntakeAnswerOptionEntity> findByIds(@Param("ids") java.util.Collection<String> ids);
}
