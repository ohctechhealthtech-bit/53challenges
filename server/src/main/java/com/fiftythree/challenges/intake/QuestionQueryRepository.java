package com.fiftythree.challenges.intake;

import com.fiftythree.challenges.entity.IntakeQuestionEntity;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** Questions belonging to one questionnaire version. */
public interface QuestionQueryRepository extends JpaRepository<IntakeQuestionEntity, String> {

  @Query("select q from IntakeQuestionEntity q where q.questionnaireId = :questionnaireId "
      + "order by q.sortOrder asc, q.id asc")
  List<IntakeQuestionEntity> findByQuestionnaire(
      @Param("questionnaireId") String questionnaireId);
}
