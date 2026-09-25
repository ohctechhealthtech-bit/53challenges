package com.fiftythree.challenges.admin;

import com.fiftythree.challenges.entity.SponsorProfileEntity;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface SponsorRepo extends JpaRepository<SponsorProfileEntity, String> {
  @Query("select s from SponsorProfileEntity s where s.status = :status "
      + "order by s.createdDate desc, s.id asc")
  List<SponsorProfileEntity> findByStatus(@Param("status") String status);
}
