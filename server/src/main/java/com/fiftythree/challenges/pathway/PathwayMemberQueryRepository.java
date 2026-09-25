package com.fiftythree.challenges.pathway;

import com.fiftythree.challenges.entity.PathwayMemberEntity;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** Which challenges belong to which pathway, and where their winners go next. */
public interface PathwayMemberQueryRepository extends JpaRepository<PathwayMemberEntity, String> {

  @Query("select m from PathwayMemberEntity m order by m.createdDate desc, m.id asc")
  List<PathwayMemberEntity> findAllNewestFirst();

  @Query("select m from PathwayMemberEntity m where m.pathwayId = :pathwayId "
      + "order by m.createdDate desc, m.id asc")
  List<PathwayMemberEntity> findByPathway(@Param("pathwayId") String pathwayId);

  @Query("select m from PathwayMemberEntity m where m.pathwayId = :pathwayId "
      + "and m.status = 'active' order by m.createdDate desc, m.id asc")
  List<PathwayMemberEntity> findActiveByPathway(@Param("pathwayId") String pathwayId);

  @Query("select m from PathwayMemberEntity m where m.challengeId = :challengeId "
      + "and m.status = 'active' order by m.createdDate desc, m.id asc")
  List<PathwayMemberEntity> findActiveByChallenge(@Param("challengeId") String challengeId);
}
