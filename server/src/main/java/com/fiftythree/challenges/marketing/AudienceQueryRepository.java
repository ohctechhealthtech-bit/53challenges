package com.fiftythree.challenges.marketing;

import com.fiftythree.challenges.entity.AudienceMemberEntity;
import java.util.List;
import org.springframework.data.domain.Limit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** The marketing audience: everyone who asked to hear about challenges. */
public interface AudienceQueryRepository extends JpaRepository<AudienceMemberEntity, String> {

  @Query("select m from AudienceMemberEntity m order by m.createdDate desc, m.id asc")
  List<AudienceMemberEntity> findAllNewestFirst(Limit limit);

  @Query("select m from AudienceMemberEntity m where lower(m.email) = lower(:email)")
  List<AudienceMemberEntity> findByEmail(@Param("email") String email);

  @Query("select m from AudienceMemberEntity m where m.organisationId = :organisationId "
      + "order by m.createdDate desc, m.id asc")
  List<AudienceMemberEntity> findByOrganisation(@Param("organisationId") String organisationId);

  @Query("select count(m) from AudienceMemberEntity m")
  long countAll();

  @Query("select count(m) from AudienceMemberEntity m where m.status = 'unsubscribed'")
  long countUnsubscribed();
}
