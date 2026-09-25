package com.fiftythree.challenges.marketing;

import com.fiftythree.challenges.entity.SponsorProfileEntity;
import java.util.List;
import org.springframework.data.domain.Limit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** Sponsor profiles, including pending applications. */
public interface SponsorQueryRepository extends JpaRepository<SponsorProfileEntity, String> {

  @Query("select s from SponsorProfileEntity s order by s.createdDate desc, s.id asc")
  List<SponsorProfileEntity> findAllNewestFirst(Limit limit);
}
