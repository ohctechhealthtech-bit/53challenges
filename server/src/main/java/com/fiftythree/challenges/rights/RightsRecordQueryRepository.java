package com.fiftythree.challenges.rights;

import com.fiftythree.challenges.entity.ParticipantRightsRecordEntity;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** What one participant granted on one entry. */
public interface RightsRecordQueryRepository extends JpaRepository<ParticipantRightsRecordEntity, String> {

  @Query("select r from ParticipantRightsRecordEntity r where r.entryId = :entryId "
      + "order by r.createdDate desc, r.id asc")
  List<ParticipantRightsRecordEntity> findByEntry(@Param("entryId") String entryId);
}
