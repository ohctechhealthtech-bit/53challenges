package com.fiftythree.challenges.intake;

import com.fiftythree.challenges.entity.ChallengeRecommendationEntity;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** Recommendations produced from an intake response. */
public interface RecommendationQueryRepository extends JpaRepository<ChallengeRecommendationEntity, String> {

  @Query("select r from ChallengeRecommendationEntity r where r.responseId = :responseId "
      + "order by r.createdDate desc, r.id asc")
  List<ChallengeRecommendationEntity> findByResponse(@Param("responseId") String responseId);

  @Query("select r from ChallengeRecommendationEntity r order by r.createdDate desc, r.id asc")
  List<ChallengeRecommendationEntity> findAllNewestFirst();
}
