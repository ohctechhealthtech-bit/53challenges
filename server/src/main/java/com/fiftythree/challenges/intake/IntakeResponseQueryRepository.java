package com.fiftythree.challenges.intake;

import com.fiftythree.challenges.entity.IntakeResponseEntity;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** Submitted intake responses. */
public interface IntakeResponseQueryRepository extends JpaRepository<IntakeResponseEntity, String> {

  @Query("select r from IntakeResponseEntity r order by r.submittedAt desc, r.id asc")
  List<IntakeResponseEntity> findAllNewestFirst();
}
