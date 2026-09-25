package com.fiftythree.challenges.intake;

import com.fiftythree.challenges.entity.IntakeQuestionnaireEntity;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** Versions of the corporate intake questionnaire. */
public interface QuestionnaireQueryRepository extends JpaRepository<IntakeQuestionnaireEntity, String> {

  /**
   * The live questionnaire, newest version first.
   *
   * <p>Editing an active questionnaire creates a new version rather than
   * changing it, so historical responses keep pointing at the exact questions
   * and options that were put to the host.
   */
  @Query("select q from IntakeQuestionnaireEntity q where q.isActive = true "
      + "order by q.version desc, q.id asc")
  List<IntakeQuestionnaireEntity> findActive();

  @Query("select q from IntakeQuestionnaireEntity q order by q.version desc, q.id asc")
  List<IntakeQuestionnaireEntity> findAllByVersion();
}
