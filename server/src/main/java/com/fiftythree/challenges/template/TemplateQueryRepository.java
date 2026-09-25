package com.fiftythree.challenges.template;

import com.fiftythree.challenges.entity.ChallengeDraftEntity;
import java.util.List;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/**
 * Template reads over the {@code challenge_draft} table.
 *
 * <p>Templates and host proposals share that one table — {@code is_template}
 * is the only thing separating a reusable template from somebody's application
 * — so every query here states it. A missing {@code is_template = true} would
 * quietly list real proposals in the admin template library.
 *
 * <p>Named {@code *QueryRepository} so it cannot collide with the generated
 * {@link com.fiftythree.challenges.entity.ChallengeDraftRepository}: two Spring
 * Data interfaces over the same entity with the same bean name fail at startup,
 * not at compile time.
 */
public interface TemplateQueryRepository extends JpaRepository<ChallengeDraftEntity, String> {

  /**
   * The template library, newest edit first. The original passed a limit of
   * 500 and then filtered in memory; the limit is kept because the wizard does
   * the same filtering client-side and a library that outgrows it should page,
   * not silently truncate a filter.
   */
  @Query("select d from ChallengeDraftEntity d where d.isTemplate = true "
      + "order by d.updatedDate desc, d.id asc")
  List<ChallengeDraftEntity> findTemplates(Pageable pageable);

  /** Every version in one family, oldest version first. */
  @Query("select d from ChallengeDraftEntity d where d.isTemplate = true "
      + "and d.templateFamilyId = :familyId order by d.templateVersion asc, d.id asc")
  List<ChallengeDraftEntity> findFamily(@Param("familyId") String familyId);

  /** One specific version of one family, used to reject duplicate imports. */
  @Query("select d from ChallengeDraftEntity d where d.isTemplate = true "
      + "and d.templateFamilyId = :familyId and d.templateVersion = :version")
  List<ChallengeDraftEntity> findFamilyVersion(
      @Param("familyId") String familyId, @Param("version") Double version);
}
