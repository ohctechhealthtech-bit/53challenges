package com.fiftythree.challenges.compliance;

import com.fiftythree.challenges.entity.PromoterAppointmentEntity;
import java.util.List;
import org.springframework.data.domain.Limit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PromoterAppointmentQueryRepository
    extends JpaRepository<PromoterAppointmentEntity, String> {

  default List<PromoterAppointmentEntity> findLatestFor(String challengeId) {
    return findByChallenge(challengeId, Limit.of(1));
  }

  @Query("select p from PromoterAppointmentEntity p where p.challengeId = :challengeId "
      + "order by p.createdDate desc, p.id asc")
  List<PromoterAppointmentEntity> findByChallenge(
      @Param("challengeId") String challengeId, Limit limit);
}
