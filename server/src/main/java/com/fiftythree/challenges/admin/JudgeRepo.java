package com.fiftythree.challenges.admin;

import com.fiftythree.challenges.entity.JudgeProfileEntity;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface JudgeRepo extends JpaRepository<JudgeProfileEntity, String> {
  @Query("select j from JudgeProfileEntity j where j.status = :status "
      + "order by j.createdDate desc, j.id asc")
  List<JudgeProfileEntity> findByStatus(@Param("status") String status);
/** A person's own judge applications, newest first. */
  @Query("select j from JudgeProfileEntity j where lower(j.email) = :email "
      + "order by j.createdDate desc, j.id asc")
  List<JudgeProfileEntity> findByEmail(
      @Param("email") String email, org.springframework.data.domain.Limit limit);
}
