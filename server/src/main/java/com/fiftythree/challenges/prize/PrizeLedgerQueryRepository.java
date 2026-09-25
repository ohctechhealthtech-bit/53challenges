package com.fiftythree.challenges.prize;

import com.fiftythree.challenges.entity.PrizeLedgerEntity;
import java.util.List;
import org.springframework.data.domain.Limit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PrizeLedgerQueryRepository extends JpaRepository<PrizeLedgerEntity, String> {

  default List<PrizeLedgerEntity> findLatestFor(String competitionId) {
    return findByCompetition(competitionId, Limit.of(5));
  }

  @Query("select l from PrizeLedgerEntity l where l.competitionId = :competitionId "
      + "order by l.createdDate desc, l.id asc")
  List<PrizeLedgerEntity> findByCompetition(
      @Param("competitionId") String competitionId, Limit limit);
}
