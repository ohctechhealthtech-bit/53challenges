package com.fiftythree.challenges.promo;

import com.fiftythree.challenges.entity.ParticipantPostEntity;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** Draft and shared promo posts, scoped to their author. */
public interface ParticipantPostQueryRepository
    extends JpaRepository<ParticipantPostEntity, String> {

  @Query("select p from ParticipantPostEntity p where lower(p.ownerEmail) = lower(:email) "
      + "order by p.createdDate desc, p.id asc")
  List<ParticipantPostEntity> findByOwner(@Param("email") String email);
}
