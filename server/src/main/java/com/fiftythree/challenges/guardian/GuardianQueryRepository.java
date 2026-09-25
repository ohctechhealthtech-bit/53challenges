package com.fiftythree.challenges.guardian;

import com.fiftythree.challenges.entity.GuardianEntity;
import java.util.List;
import org.springframework.data.domain.Limit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface GuardianQueryRepository extends JpaRepository<GuardianEntity, String> {

  default List<GuardianEntity> findLatestByEmail(String email) {
    return findByEmail(email, Limit.of(1));
  }

  @Query("select g from GuardianEntity g where lower(g.email) = :email "
      + "order by g.createdDate desc, g.id asc")
  List<GuardianEntity> findByEmail(@Param("email") String email, Limit limit);
}
