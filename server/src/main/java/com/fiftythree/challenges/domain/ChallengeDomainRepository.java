package com.fiftythree.challenges.domain;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ChallengeDomainRepository extends JpaRepository<ChallengeDomainEntity, String> {

  /**
   * Matches on the stored hostname rather than the slug, so the mapping stays
   * correct if the app is ever served from more than one base domain — the same
   * reasoning the Base44 function's 'resolve' action used.
   *
   * <p>Status is deliberately not filtered here: a record is live under several
   * different status values, and that list belongs next to the code that
   * understands it rather than buried in a query.
   */
  @Query("select d from ChallengeDomainEntity d where lower(d.fullDomain) = lower(:host) "
      + "order by d.createdDate desc")
  List<ChallengeDomainEntity> findByHost(@Param("host") String host);

  /** Newest first, matching the '-created_date' ordering the function used. */
  List<ChallengeDomainEntity> findAllByOrderByCreatedDateDesc();
}
