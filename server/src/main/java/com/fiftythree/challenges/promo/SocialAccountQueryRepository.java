package com.fiftythree.challenges.promo;

import com.fiftythree.challenges.entity.ParticipantSocialAccountEntity;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** A participant's linked social accounts, scoped to whoever owns them. */
public interface SocialAccountQueryRepository
    extends JpaRepository<ParticipantSocialAccountEntity, String> {

  @Query("select a from ParticipantSocialAccountEntity a where lower(a.ownerEmail) = lower(:email) "
      + "order by a.createdDate desc, a.id asc")
  List<ParticipantSocialAccountEntity> findByOwner(@Param("email") String email);

  @Query("select a from ParticipantSocialAccountEntity a where lower(a.ownerEmail) = lower(:email) "
      + "and a.platform = :platform order by a.createdDate desc, a.id asc")
  List<ParticipantSocialAccountEntity> findByOwnerAndPlatform(
      @Param("email") String email, @Param("platform") String platform);
}
