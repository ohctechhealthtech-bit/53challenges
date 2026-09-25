package com.fiftythree.challenges.rights;

import com.fiftythree.challenges.entity.MediaReleaseEntity;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** Releases from people who appear in an entry but did not submit it. */
public interface MediaReleaseQueryRepository extends JpaRepository<MediaReleaseEntity, String> {

  @Query("select m from MediaReleaseEntity m where m.entryId = :entryId "
      + "order by m.createdDate desc, m.id asc")
  List<MediaReleaseEntity> findByEntry(@Param("entryId") String entryId);
}
