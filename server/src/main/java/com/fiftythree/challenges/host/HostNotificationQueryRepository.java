package com.fiftythree.challenges.host;

import com.fiftythree.challenges.entity.HostNotificationEntity;
import java.util.List;
import org.springframework.data.domain.Limit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** In-app notifications for a host. */
public interface HostNotificationQueryRepository
    extends JpaRepository<HostNotificationEntity, String> {

  @Query("select n from HostNotificationEntity n "
      + "where lower(n.recipientEmail) = lower(:email) "
      + "order by n.createdDate desc, n.id asc")
  List<HostNotificationEntity> findFor(@Param("email") String email, Limit limit);
}
